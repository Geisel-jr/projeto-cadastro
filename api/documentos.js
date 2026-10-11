const crypto = require('crypto');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { enviarArquivo, lerArquivo, removerArquivo } = require('./storage');
const { linhaParaObjeto, emTransacao, registrarAuditoria, lerMotivo, ErroHttp } = require('./util');

// Tipos de documento oferecidos no cadastro. "Cartão CNPJ" é o padrão.
const TIPOS_DOCUMENTO = [
  'Cartão CNPJ',
  'Contrato Social',
  'Inscrição Estadual',
  'Alvará de Funcionamento',
  'Certidão Negativa Federal (CND)',
  'Certificado de Regularidade do FGTS (CRF)',
  'Certidão Negativa de Débitos Trabalhistas (CNDT)',
  'Comprovante de Endereço',
  'Comprovante Bancário',
  'Procuração',
  'Outros',
];

const TIPOS_ARQUIVO = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};
const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

// O arquivo fica na memória só até ser enviado ao MinIO
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO, files: 1 } });

const CONSULTA = `SELECT d.*, COALESCE(e.nome_fantasia, e.nome) AS empresa_nome
                  FROM documentos d JOIN empresas e ON e.id = d.empresa_id`;

// Navegadores enviam o nome do arquivo em UTF-8, mas o multer o lê como latin1
function nomeOriginal(arquivo) {
  const nome = arquivo.originalname;
  if ([...nome].some((c) => c.charCodeAt(0) > 255)) return nome;
  const convertido = Buffer.from(nome, 'latin1').toString('utf8');
  return convertido.includes('�') ? nome : convertido;
}

const lerId = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'ID inválido.');
  return id;
};

// Rotas de documentos de uma empresa: /api/empresas/:empresaId/documentos
function rotasDocumentos({ pool }) {
  const router = express.Router({ mergeParams: true });

  const buscarEmpresa = async (db, empresaId) => {
    const { rows } = await db.query('SELECT id, excluido_em FROM empresas WHERE id = $1', [empresaId]);
    if (!rows[0]) throw new ErroHttp(404, 'Empresa não encontrada.');
    return rows[0];
  };

  const buscarDocumento = async (db, empresaId, docId, bloquear = false) => {
    const { rows } = await db.query(
      `${CONSULTA} WHERE d.id = $1 AND d.empresa_id = $2${bloquear ? ' FOR UPDATE OF d' : ''}`,
      [docId, empresaId]
    );
    if (!rows[0]) throw new ErroHttp(404, 'Documento não encontrado.');
    return linhaParaObjeto(rows[0]);
  };

  // As ações com anexos aparecem no histórico da própria empresa
  const auditar = (db, req, empresaId, acao, dados) =>
    registrarAuditoria(db, req, { entidade: 'empresas', registroId: empresaId, acao, ...dados });

  router.get('/', async (req, res) => {
    const empresaId = lerId(req.params.empresaId);
    const excluidos = req.query.status === 'excluidos';
    const { rows } = await pool.query(
      `${CONSULTA} WHERE d.empresa_id = $1 AND d.excluido_em IS ${excluidos ? 'NOT ' : ''}NULL
       ORDER BY d.criado_em DESC`,
      [empresaId]
    );
    res.json(rows.map(linhaParaObjeto));
  });

  router.post('/', upload.single('arquivo'), async (req, res) => {
    const empresaId = lerId(req.params.empresaId);
    const arquivo = req.file;
    const tipo = String(req.body.tipo || '').trim();
    const descricao = String(req.body.descricao || '').trim() || null;
    const validade = String(req.body.validade || '').trim() || null;

    const erros = {};
    if (!arquivo) erros.arquivo = 'Selecione um arquivo.';
    if (!TIPOS_DOCUMENTO.includes(tipo)) erros.tipo = 'Tipo de documento inválido.';
    if (tipo === 'Outros' && !descricao) erros.descricao = 'Descreva o documento.';
    if (descricao && descricao.length > 150) erros.descricao = 'Máximo de 150 caracteres.';
    if (validade && (!/^\d{4}-\d{2}-\d{2}$/.test(validade) || isNaN(Date.parse(validade)))) {
      erros.validade = 'Data inválida.';
    }

    const nome = arquivo ? nomeOriginal(arquivo) : '';
    const extensao = path.extname(nome).toLowerCase();
    if (arquivo && !TIPOS_ARQUIVO[arquivo.mimetype]?.includes(extensao)) {
      erros.arquivo = 'Formato não permitido. Envie PDF, imagem (PNG, JPG, WEBP), DOCX ou XLSX.';
    }
    if (Object.keys(erros).length > 0) throw new ErroHttp(400, 'Verifique os campos destacados.', erros);

    const empresa = await buscarEmpresa(pool, empresaId);
    if (empresa.excluido_em) throw new ErroHttp(409, 'Não é possível anexar documentos a uma empresa excluída.');

    // O nome no storage é gerado (nunca o nome enviado pelo usuário)
    const objeto = `empresas/${empresaId}/${crypto.randomUUID()}${extensao}`;
    await enviarArquivo(objeto, arquivo.buffer, arquivo.mimetype);

    try {
      const documento = await emTransacao(pool, async (db) => {
        const { rows } = await db.query(
          `INSERT INTO documentos (empresa_id, tipo, descricao, validade, nome_arquivo, objeto, content_type, tamanho, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [empresaId, tipo, descricao, validade, nome.slice(0, 255), objeto, arquivo.mimetype, arquivo.size, req.usuario]
        );
        const novo = await buscarDocumento(db, empresaId, rows[0].id);
        await auditar(db, req, empresaId, 'ANEXAR', { depois: novo });
        return novo;
      });
      res.status(201).json(documento);
    } catch (erro) {
      await removerArquivo(objeto); // não deixa arquivo órfão no storage
      throw erro;
    }
  });

  // Visualiza (inline) ou baixa (?download=1) o arquivo
  router.get('/:docId/arquivo', async (req, res) => {
    const documento = await buscarDocumento(pool, lerId(req.params.empresaId), lerId(req.params.docId));
    const fluxo = await lerArquivo(documento.objeto);

    const disposicao = req.query.download ? 'attachment' : 'inline';
    res.set({
      'Content-Type': documento.contentType,
      'Content-Length': documento.tamanho,
      'Content-Disposition': `${disposicao}; filename*=UTF-8''${encodeURIComponent(documento.nomeArquivo)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    fluxo.on('error', () => res.destroy());
    fluxo.pipe(res);
  });

  // Soft delete: o arquivo continua no storage e o registro no banco
  router.delete('/:docId', async (req, res) => {
    const empresaId = lerId(req.params.empresaId);
    const docId = lerId(req.params.docId);
    const motivo = lerMotivo(req.body);

    const documento = await emTransacao(pool, async (db) => {
      const antes = await buscarDocumento(db, empresaId, docId, true);
      if (antes.excluidoEm) throw new ErroHttp(409, 'Este documento já foi removido.');
      await db.query(
        'UPDATE documentos SET excluido_em = NOW(), excluido_por = $1, motivo_exclusao = $2 WHERE id = $3',
        [req.usuario, motivo, docId]
      );
      const depois = await buscarDocumento(db, empresaId, docId);
      await auditar(db, req, empresaId, 'REMOVER_ANEXO', { antes, depois, motivo });
      return depois;
    });
    res.json(documento);
  });

  router.post('/:docId/restaurar', async (req, res) => {
    const empresaId = lerId(req.params.empresaId);
    const docId = lerId(req.params.docId);

    const documento = await emTransacao(pool, async (db) => {
      const antes = await buscarDocumento(db, empresaId, docId, true);
      if (!antes.excluidoEm) throw new ErroHttp(409, 'Este documento não está removido.');
      await db.query(
        'UPDATE documentos SET excluido_em = NULL, excluido_por = NULL, motivo_exclusao = NULL WHERE id = $1',
        [docId]
      );
      const depois = await buscarDocumento(db, empresaId, docId);
      await auditar(db, req, empresaId, 'RESTAURAR_ANEXO', { antes, depois });
      return depois;
    });
    res.json(documento);
  });

  return router;
}

module.exports = { rotasDocumentos, TIPOS_DOCUMENTO, TIPOS_ARQUIVO, TAMANHO_MAXIMO };

const crypto = require('crypto');
const { validar, REGRAS_EMPRESA, REGRAS_PESSOA } = require('./validacoes');
const { TIPOS_DOCUMENTO } = require('./documentos');
const { enviarArquivo } = require('./storage');
const { paraSnake, linhaParaObjeto, emTransacao } = require('./util');
const dados = require('./seeds/dados-exemplo.json');

// Dados de exemplo (seed): empresas, pessoas e documentos fictícios gravados na primeira subida,
// com o banco vazio, para o sistema não começar em branco. Os registros passam pela mesma
// validação da API e ganham histórico na auditoria, como se tivessem sido cadastrados pela tela.
// Desligue com DADOS_EXEMPLO=false no .env.

const AUTOR = 'Dados de exemplo';

const diasAtras = (dias) => new Date(Date.now() - dias * 86400000);
const diaRelativo = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

// Mesmo formato do registrarAuditoria, mas com a data do cadastro (no passado)
const auditar = (db, { entidade, registroId, acao, antes = null, depois = null, motivo = null, data }) =>
  db.query(
    `INSERT INTO auditoria (entidade, registro_id, acao, usuario, dados_anteriores, dados_novos, motivo, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [entidade, registroId, acao, AUTOR, antes && JSON.stringify(antes), depois && JSON.stringify(depois), motivo, data]
  );

// Grava um cadastro validado (e a exclusão, quando o exemplo vem marcado como excluído)
async function inserirCadastro(db, tabela, regras, registro, extras = {}) {
  const { dados: valores, erros } = validar(regras, registro);
  if (Object.keys(erros).length > 0) {
    throw new Error(`Dado de exemplo inválido em ${tabela} (${registro.nome}): ${JSON.stringify(erros)}`);
  }
  const campos = { ...valores, ...extras };
  const colunas = Object.keys(campos).map(paraSnake);
  const criadoEm = diasAtras(registro.diasAtras);
  const { rows } = await db.query(
    `INSERT INTO ${tabela} (${colunas.join(', ')}, criado_por, criado_em)
     VALUES (${colunas.map((_, i) => `$${i + 1}`).join(', ')}, $${colunas.length + 1}, $${colunas.length + 2})
     RETURNING *`,
    [...Object.values(campos), AUTOR, criadoEm]
  );
  const novo = rows[0];
  await auditar(db, { entidade: tabela, registroId: novo.id, acao: 'CRIAR', depois: linhaParaObjeto(novo), data: criadoEm });

  if (registro.excluida) {
    const excluidoEm = diasAtras(registro.excluida.diasAtras);
    const { rows: [excluido] } = await db.query(
      `UPDATE ${tabela} SET excluido_em = $1, excluido_por = $2, motivo_exclusao = $3 WHERE id = $4 RETURNING *`,
      [excluidoEm, AUTOR, registro.excluida.motivo, novo.id]
    );
    await auditar(db, {
      entidade: tabela, registroId: novo.id, acao: 'EXCLUIR', motivo: registro.excluida.motivo, data: excluidoEm,
      antes: linhaParaObjeto(novo), depois: linhaParaObjeto(excluido),
    });
  }
  return novo;
}

// PDF de uma página com texto simples (Helvetica). Serve de arquivo para os documentos de exemplo.
function gerarPdf(linhas) {
  const escapar = (texto) => texto.replace(/[\\()]/g, (c) => `\\${c}`);
  const conteudo = linhas
    .map((linha, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 72 ${760 - i * 26} Td (${escapar(linha)}) Tj ET`)
    .join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posicoes = objetos.map((objeto, i) => {
    const posicao = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return posicao;
  });
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1'); // latin1 = WinAnsi para os acentos do português
}

const nomeArquivo = (tipo, empresa) =>
  `${tipo} ${empresa.nome_fantasia || empresa.nome}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.pdf';

async function popularDadosExemplo(pool) {
  const arquivos = [];

  const totais = await emTransacao(pool, async (db) => {
    const empresas = {};
    for (const { chave, ...empresa } of dados.empresas) {
      empresas[chave] = await inserirCadastro(db, 'empresas', REGRAS_EMPRESA, empresa);
    }

    for (const { empresa, ...pessoa } of dados.pessoas) {
      const empresaId = empresa ? empresas[empresa].id : null;
      await inserirCadastro(db, 'pessoas', REGRAS_PESSOA, { ...pessoa, empresaId });
    }

    for (const doc of dados.documentos) {
      if (!TIPOS_DOCUMENTO.includes(doc.tipo)) throw new Error(`Tipo de documento inválido nos dados de exemplo: ${doc.tipo}`);
      const empresa = empresas[doc.empresa];
      const validade = doc.validadeEmDias === undefined ? null : diaRelativo(doc.validadeEmDias);
      const pdf = gerarPdf([
        'DOCUMENTO DE EXEMPLO',
        doc.descricao ? `${doc.tipo}: ${doc.descricao}` : doc.tipo,
        empresa.nome,
        `CNPJ ${empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`,
        validade ? `Validade: ${validade.split('-').reverse().join('/')}` : 'Sem validade',
        '',
        'Arquivo gerado pelos dados de exemplo do CadastroHub. Sem valor legal.',
      ]);
      const objeto = `empresas/${empresa.id}/${crypto.randomUUID()}.pdf`;
      const criadoEm = new Date(new Date(empresa.criado_em).getTime() + 86400000); // um dia depois da empresa
      const { rows } = await db.query(
        `INSERT INTO documentos (empresa_id, tipo, descricao, validade, nome_arquivo, objeto, content_type, tamanho, criado_por, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, 'application/pdf', $7, $8, $9) RETURNING *`,
        [empresa.id, doc.tipo, doc.descricao || null, validade, nomeArquivo(doc.tipo, empresa), objeto, pdf.length, AUTOR, criadoEm]
      );
      await auditar(db, {
        entidade: 'empresas', registroId: empresa.id, acao: 'ANEXAR', data: criadoEm,
        depois: { ...linhaParaObjeto(rows[0]), empresaNome: empresa.nome_fantasia || empresa.nome },
      });
      arquivos.push({ objeto, pdf });
    }
    return { empresas: dados.empresas.length, pessoas: dados.pessoas.length, documentos: dados.documentos.length };
  });

  // Os arquivos vão para o MinIO depois que o banco confirmou os registros
  let enviados = 0;
  for (const { objeto, pdf } of arquivos) {
    try {
      await enviarArquivo(objeto, pdf, 'application/pdf');
      enviados++;
    } catch (erro) {
      console.warn(`⚠️  Arquivo de exemplo não enviado ao storage (${objeto}): ${erro.message}`);
    }
  }
  console.log(`🌱 Dados de exemplo: ${totais.empresas} empresas, ${totais.pessoas} pessoas e ${enviados} documentos`);
}

module.exports = { popularDadosExemplo };

const express = require('express');
const { gerarHash, validarForcaSenha } = require('./senhas');
const { revogarSessoesDoUsuario, usuarioPublico } = require('./auth');
const { encerrarDesafios } = require('./mfa');
const { emTransacao, registrarAuditoria, lerId, ErroHttp } = require('./util');

const PAPEIS = ['admin', 'operador'];

// Dados do usuário para listagem e auditoria (sem hash de senha)
const resumo = (u) => ({
  ...usuarioPublico(u),
  ativo: u.ativo,
  ultimoLoginEm: u.ultimo_login_em,
  criadoEm: u.criado_em,
});

function lerDados(corpo) {
  const nome = String(corpo?.nome ?? '').trim();
  const email = String(corpo?.email ?? '').trim().toLowerCase();
  const papel = String(corpo?.papel ?? 'operador');
  const erros = {};
  if (nome.length < 2 || nome.length > 100) erros.nome = 'Informe o nome (2 a 100 caracteres).';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 150) erros.email = 'E-mail inválido.';
  if (!PAPEIS.includes(papel)) erros.papel = 'Perfil inválido.';
  return { nome, email, papel, erros };
}

// Rotas de usuários (/api/usuarios). Montadas atrás de autenticar + exigirPapel('admin').
function rotasUsuarios({ pool }) {
  const router = express.Router();

  const buscar = async (db, id, bloquear = false) => {
    const { rows } = await db.query(`SELECT * FROM usuarios WHERE id = $1${bloquear ? ' FOR UPDATE' : ''}`, [id]);
    if (!rows[0]) throw new ErroHttp(404, 'Usuário não encontrado.');
    return rows[0];
  };

  const auditar = (db, req, id, acao, dados) =>
    registrarAuditoria(db, req, { entidade: 'usuarios', registroId: id, acao, ...dados });

  router.get('/', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM usuarios ORDER BY ativo DESC, nome');
    res.json(rows.map(resumo));
  });

  // Cria um usuário. Sem senha, ele só consegue entrar com o Google (pelo e-mail).
  // Com senha, ela é provisória: o sistema exige a troca no primeiro acesso.
  router.post('/', async (req, res) => {
    const { nome, email, papel, erros } = lerDados(req.body);
    const senha = String(req.body?.senha ?? '');
    if (senha) {
      const fraca = validarForcaSenha(senha);
      if (fraca) erros.senha = fraca;
    }
    if (Object.keys(erros).length) throw new ErroHttp(400, 'Verifique os campos destacados.', erros);

    const hash = senha ? await gerarHash(senha) : null;
    const usuario = await emTransacao(pool, async (db) => {
      const { rows } = await db.query(
        `INSERT INTO usuarios (nome, email, senha_hash, papel, deve_trocar_senha, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [nome, email, hash, papel, Boolean(hash), req.usuario]
      );
      await auditar(db, req, rows[0].id, 'CRIAR', { depois: resumo(rows[0]) });
      return rows[0];
    });
    res.status(201).json(resumo(usuario));
  });

  // Edita nome, e-mail, perfil e situação (ativo/inativo)
  router.put('/:id', async (req, res) => {
    const id = lerId(req.params.id);
    const { nome, email, papel, erros } = lerDados(req.body);
    const ativo = req.body?.ativo !== false;
    if (Object.keys(erros).length) throw new ErroHttp(400, 'Verifique os campos destacados.', erros);

    // Evita que o administrador se tranque para fora do sistema
    if (id === req.usuarioId && (!ativo || papel !== 'admin')) {
      throw new ErroHttp(400, 'Você não pode desativar nem remover o perfil de administrador da sua própria conta.');
    }

    const usuario = await emTransacao(pool, async (db) => {
      const antes = await buscar(db, id, true);
      const trocouEmail = email !== antes.email.toLowerCase();
      // Com e-mail novo, a conta Google vinculada (a do e-mail antigo) deixa de entrar;
      // o vínculo é refeito no próximo login com Google pelo e-mail novo.
      const { rows } = await db.query(
        `UPDATE usuarios SET nome = $1, email = $2, papel = $3, ativo = $4, atualizado_em = NOW(),
                google_id = CASE WHEN $5 THEN NULL ELSE google_id END
          WHERE id = $6 RETURNING *`,
        [nome, email, papel, ativo, trocouEmail, id]
      );
      if (antes.ativo && !ativo) await revogarSessoesDoUsuario(db, id); // desativado: cai na hora
      if (trocouEmail) {
        // Links e códigos já enviados foram para o endereço antigo: deixam de valer
        await db.query('UPDATE redefinicoes_senha SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL', [id]);
        await encerrarDesafios(db, id);
      }
      await auditar(db, req, id, 'EDITAR', { antes: resumo(antes), depois: resumo(rows[0]) });
      return rows[0];
    });
    res.json(resumo(usuario));
  });

  // Define uma senha provisória (o usuário troca no próximo login)
  router.post('/:id/redefinir-senha', async (req, res) => {
    const id = lerId(req.params.id);
    const senha = String(req.body?.senha ?? '');
    const fraca = validarForcaSenha(senha);
    if (fraca) throw new ErroHttp(400, fraca, { senha: fraca });

    const hash = await gerarHash(senha);
    await emTransacao(pool, async (db) => {
      const usuario = await buscar(db, id, true);
      await db.query(
        'UPDATE usuarios SET senha_hash = $1, deve_trocar_senha = TRUE, demo = FALSE, atualizado_em = NOW() WHERE id = $2',
        [hash, id]
      );
      await revogarSessoesDoUsuario(db, id);
      await auditar(db, req, id, 'REDEFINIR_SENHA', { depois: { nome: usuario.nome, email: usuario.email } });
    });
    res.status(204).end();
  });

  return router;
}

module.exports = { rotasUsuarios };

const express = require('express');
const { Pool, types } = require('pg');
const cors = require('cors');
require('dotenv').config();

const { validarEmpresa, validarPessoa } = require('./validacoes');

// Faz colunas DATE voltarem como texto "AAAA-MM-DD", evitando problemas de fuso horário
types.setTypeParser(1082, (valor) => valor);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conexão com PostgreSQL (dados vêm do .env ou das variáveis do docker-compose)
const pool = new Pool({
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 5432,
  database: process.env.DATABASE_NAME,
});

// Transforma erros do banco em respostas amigáveis
function responderErro(res, error, documento) {
  if (error.code === '23505') {
    return res.status(409).json({ error: `Já existe um cadastro com este ${documento}.` });
  }
  console.error(error);
  return res.status(500).json({ error: 'Erro interno no servidor.' });
}

// Verifica se a API e o banco estão no ar
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'erro', error: 'Banco de dados indisponível.' });
  }
});

// ========== ROTAS DE EMPRESAS ==========

// Criar empresa
app.post('/api/empresas', async (req, res) => {
  const { dados, erros } = validarEmpresa(req.body);
  if (erros.length > 0) {
    return res.status(400).json({ error: erros.join(' '), erros });
  }

  try {
    const { nome, cnpj, email, telefone, cep, endereco, cidade, estado } = dados;
    const result = await pool.query(
      'INSERT INTO empresas (nome, cnpj, email, telefone, cep, endereco, cidade, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [nome, cnpj, email, telefone, cep, endereco, cidade, estado]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    responderErro(res, error, 'CNPJ');
  }
});

// Buscar todas as empresas
app.get('/api/empresas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM empresas ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    responderErro(res, error);
  }
});

// ========== ROTAS DE PESSOAS ==========

// Criar pessoa
app.post('/api/pessoas', async (req, res) => {
  const { dados, erros } = validarPessoa(req.body);
  if (erros.length > 0) {
    return res.status(400).json({ error: erros.join(' '), erros });
  }

  try {
    const { nome, cpf, email, telefone, dataNascimento, profissao } = dados;
    const result = await pool.query(
      'INSERT INTO pessoas (nome, cpf, email, telefone, data_nascimento, profissao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nome, cpf, email, telefone, dataNascimento, profissao]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    responderErro(res, error, 'CPF');
  }
});

// Buscar todas as pessoas
app.get('/api/pessoas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pessoas ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    responderErro(res, error);
  }
});

// ========== INICIAR SERVIDOR ==========

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});

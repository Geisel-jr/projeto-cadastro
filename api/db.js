const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const { emTransacao } = require('./util');

// Faz colunas DATE voltarem como texto "AAAA-MM-DD", evitando problemas de fuso horário
types.setTypeParser(1082, (valor) => valor);

// Conexão com PostgreSQL (dados vêm do .env ou das variáveis do docker-compose)
const pool = new Pool({
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 5432,
  database: process.env.DATABASE_NAME,
});

// Executa, em ordem, os arquivos de api/migrations que ainda não rodaram neste banco.
// Assim o banco é atualizado automaticamente sem perder os dados existentes.
async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome         VARCHAR(200) PRIMARY KEY,
      executado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  const pasta = path.join(__dirname, 'migrations');
  const arquivos = fs.readdirSync(pasta).filter((arquivo) => arquivo.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT nome FROM schema_migrations');
  const executadas = new Set(rows.map((linha) => linha.nome));

  for (const arquivo of arquivos) {
    if (executadas.has(arquivo)) continue;

    const sql = fs.readFileSync(path.join(pasta, arquivo), 'utf8');
    await emTransacao(pool, async (db) => {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
    });
    console.log(`📦 Migração aplicada: ${arquivo}`);
  }
}

module.exports = { pool, migrar };

const Minio = require('minio');
const { ErroHttp } = require('./util');

// Conexão com o MinIO (storage compatível com Amazon S3), onde ficam os arquivos anexados.
const BUCKET = process.env.MINIO_BUCKET || 'documentos';

const cliente = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

let pronto = false;

// Cria o bucket se ainda não existir. Se o MinIO estiver fora do ar, a API sobe
// normalmente e tenta de novo na próxima vez que alguém usar os anexos.
async function prepararStorage() {
  try {
    if (!(await cliente.bucketExists(BUCKET))) await cliente.makeBucket(BUCKET);
    pronto = true;
    console.log(`🗄️  Storage pronto (bucket "${BUCKET}")`);
  } catch (erro) {
    console.warn(`⚠️  Storage indisponível: ${erro.message}`);
  }
}

async function garantirStorage() {
  if (!pronto) await prepararStorage();
  if (!pronto) throw new ErroHttp(503, 'O storage de arquivos está indisponível no momento.');
}

async function enviarArquivo(objeto, buffer, contentType) {
  await garantirStorage();
  await cliente.putObject(BUCKET, objeto, buffer, buffer.length, { 'Content-Type': contentType });
}

async function lerArquivo(objeto) {
  await garantirStorage();
  return cliente.getObject(BUCKET, objeto);
}

// Usado só para desfazer um envio quando a gravação no banco falha
async function removerArquivo(objeto) {
  await cliente.removeObject(BUCKET, objeto).catch(() => {});
}

module.exports = { prepararStorage, enviarArquivo, lerArquivo, removerArquivo };

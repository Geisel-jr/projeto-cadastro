# Operação e desenvolvimento

[Voltar ao README](../README.md)

## Documentos

Os arquivos ficam no MinIO, que funciona como o Amazon S3, no bucket `documentos`. A API cria o bucket
sozinha. No banco fica só o registro do documento: tipo, validade, nome original, tamanho e o caminho do
arquivo no MinIO.

- Tipos: Cartão CNPJ (o padrão), Contrato Social, Inscrição Estadual, Alvará de Funcionamento, Certidão
  Negativa Federal (CND), Certificado de Regularidade do FGTS (CRF), Certidão Negativa de Débitos
  Trabalhistas (CNDT), Comprovante de Endereço, Comprovante Bancário, Procuração e Outros (que exige
  uma descrição).
- Formatos aceitos: PDF, PNG, JPG, WEBP, DOCX e XLSX, com até 10 MB.
- O nome do arquivo no MinIO é gerado pela API. O nome enviado pelo usuário nunca é usado como caminho.
- Remover um documento também não apaga o arquivo. Ele continua no MinIO e pode ser restaurado.
- Anexar, remover e restaurar aparecem no histórico da empresa.
- A lista de empresas avisa quando falta o cartão CNPJ.

O painel do MinIO fica em http://localhost:9001 (usuário `minioadmin`, senha `minioadmin123`).

A imagem oficial `minio/minio` não é mais publicada no Docker Hub. Por isso o projeto usa a
`pgsty/minio`, uma versão mantida pela comunidade que funciona do mesmo jeito.

## Backup

O container `backup` faz uma cópia quando sobe e depois a cada 24 horas, na pasta `backups/` do projeto
(que não vai para o git).

- `backups/banco/AAAA-MM-DD_HH-MM-SS.dump` é a cópia completa do banco feita com `pg_dump`, inclusive a
  auditoria. Ficam guardadas as dos últimos 7 dias.
- `backups/arquivos/` é uma cópia dos documentos do MinIO. Como nenhum documento é apagado de verdade,
  essa pasta só cresce, e cada backup copia apenas o que é novo.

O intervalo, quantos dias guardar e o fuso horário podem ser mudados no `.env`
(`BACKUP_INTERVALO_HORAS`, `BACKUP_RETENCAO_DIAS` e `FUSO_HORARIO`).

```bash
docker compose exec backup backup.sh agora      # faz um backup na hora
docker compose exec backup restaurar.sh         # lista os backups disponíveis
docker compose exec -e CONFIRMAR=sim backup restaurar.sh ultimo   # restaura o mais recente
docker compose restart api                      # depois de restaurar
```

Cuidado: restaurar troca todos os dados atuais pelos do backup, inclusive a auditoria feita depois dele.
Por isso o comando só roda com `CONFIRMAR=sim`. Para não perder tudo se o computador der problema,
copie a pasta `backups/` para outro lugar, como um HD externo ou a nuvem.

## Como rodar sem Docker

1. Crie o banco `cadastros_db` no seu PostgreSQL. As tabelas são criadas pela API quando ela inicia.
   Para os anexos funcionarem, suba só o MinIO com `docker compose up -d minio`.
2. Rode a API:
   ```bash
   cd api
   cp .env.example .env   # coloque a senha do seu PostgreSQL
   npm install
   npm run dev
   ```
3. Rode o front-end em outro terminal, na pasta raiz do projeto:
   ```bash
   npm install
   npm start
   ```
   O front abre em http://localhost:3000 e usa a API em `http://localhost:5000/api`.

## Testes

```bash
npm test              # front-end
cd api && npm test    # API: testes de senhas e tokens
```

No GitHub Actions, a cada push, o CI roda esses testes, sobe o sistema inteiro no Docker e testa login,
cadastros, documentos, backup, recuperação de senha e o código de acesso.

## Pastas do projeto

```
├── src/                  # Front-end React
│   ├── cadastros/        # Campos, abas e colunas dos formulários
│   ├── paginas/          # Login, painel, listas, formulário, auditoria e usuários
│   ├── components/       # Componentes reaproveitados (modal, histórico, campos, ícones)
│   ├── utils/            # Máscaras, validações, formatação e busca de CEP/CNPJ
│   ├── sessao.js         # Token de acesso em memória e renovação automática
│   ├── rotas.js          # Endereços das páginas e título da aba
│   └── api.js            # Chamadas à API
├── api/                  # API Node.js/Express
│   ├── server.js         # Configuração, segurança, auditoria e tratamento de erros
│   ├── auth.js           # Login (senha e Google), sessões e proteção das rotas
│   ├── usuarios.js       # Gestão de usuários (administrador)
│   ├── recuperacao.js    # Esqueci minha senha (link por e-mail)
│   ├── mfa.js            # Código de acesso por e-mail
│   ├── email.js          # Envio de e-mails (SMTP / Mailpit)
│   ├── senhas.js         # Hash e regras de senha (scrypt)
│   ├── tokens.js         # JWT de acesso e refresh tokens
│   ├── test/             # Testes de senhas e tokens (node --test)
│   ├── cadastros.js      # Rotas de cadastro (com soft delete e auditoria)
│   ├── documentos.js     # Rotas de documentos (envio, download, remoção e restauração)
│   ├── storage.js        # Conexão com o MinIO
│   ├── validacoes.js     # Validação dos dados recebidos
│   ├── db.js             # Conexão com o banco e migrations
│   ├── util.js           # Funções comuns (transação, auditoria, erros HTTP)
│   ├── openapi.js        # Descrição da API mostrada pelo Swagger em /api/docs
│   ├── seeds.js          # Cadastra os dados de exemplo na primeira vez
│   ├── seeds/            # Dados de exemplo (empresas, pessoas e documentos fictícios)
│   └── migrations/       # Scripts SQL que criam e atualizam o banco
├── docs/                 # Esta documentação
├── backup/               # Imagem e scripts de backup e restauração (pg_dump + mc)
├── nginx.conf            # Servidor do front (repassa /api para a API)
├── dockerfile            # Imagem do front
└── docker-compose.yml    # Sobe banco, MinIO, API, front, e-mail e backup juntos
```

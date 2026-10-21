# CadastroHub

[![CI](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml/badge.svg)](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml)

Sistema de cadastro de **empresas** e **pessoas**, com front-end em React, API em Node.js/Express,
banco PostgreSQL e storage de arquivos MinIO, tudo rodando em containers Docker.

## Funcionalidades

- **Login** com e-mail e senha ou com **Google**, sessão com JWT e gestão de usuários (administrador e operador)
- Cadastro, edição e exclusão de empresas e pessoas, com formulários organizados em abas
- **Soft delete**: registros excluídos saem das listagens, mas continuam no banco e podem ser restaurados
- **Auditoria**: toda inclusão, edição, exclusão e restauração registra quem fez, quando, de qual IP e o que mudou
- Preenchimento automático pelo CNPJ (dados da Receita Federal via [BrasilAPI](https://brasilapi.com.br)) e pelo CEP ([ViaCEP](https://viacep.com.br))
- Máscaras e validação de CPF, CNPJ, telefone e CEP (no front e na API)
- **Documentos da empresa** (cartão CNPJ, contrato social, certidões...) guardados no MinIO, com validade,
  visualização, download, remoção com motivo e restauração
- Vínculo entre pessoa e empresa
- Busca nas listagens e filtro de ativos/excluídos
- Migrations automáticas do banco
- Layout responsivo (desktop e celular)

## Auditoria e exclusão

Nenhum cadastro é apagado de verdade. Ao excluir, o sistema pede um **motivo** e apenas marca o registro
como excluído (`excluido_em`, `excluido_por`, `motivo_exclusao`). Ele pode ser consultado e restaurado
pelo filtro **Excluídos** da listagem.

Cada ação grava uma linha na tabela `auditoria`, na mesma transação da alteração, com o registro antes
e depois da mudança. Essa tabela é protegida por um trigger no banco: **não aceita UPDATE nem DELETE**.

O autor de cada ação vem do usuário logado (nome e id, tirados do token). Logins, saídas, tentativas
recusadas e trocas de senha também ficam na auditoria.

Hard delete só é usado para sessões vencidas há mais de 30 dias, que não têm valor de auditoria
(os logins já estão registrados na tabela `auditoria`).

## Autenticação e segurança

**Como a sessão funciona**

1. No login (senha ou Google), a API devolve um **token de acesso (JWT)** válido por 15 minutos e grava um
   **refresh token** num cookie.
2. O front guarda o token de acesso **só na memória** (nunca no `localStorage`) e o envia em toda
   requisição: `Authorization: Bearer <token>`.
3. Quando o token está para vencer, o front chama `/api/auth/renovar`. A API confere o cookie, troca o
   refresh token por um novo (**rotação**) e entrega outro token de acesso. Ao recarregar a página, o
   mesmo processo recupera a sessão sem pedir login.

**Proteções**

| Risco | Proteção |
| --- | --- |
| Senhas vazadas do banco | Hash com **scrypt** (parâmetros da OWASP: N=2^17, r=8, p=1) e sal aleatório |
| Roubo de token por XSS | Token de acesso só na memória; refresh token em cookie **httpOnly**; CSP no nginx |
| CSRF | Cookie **SameSite=Strict**, restrito a `/api/auth`, e cabeçalho `X-Requested-With` obrigatório |
| Token roubado reutilizado | Refresh token trocado a cada uso; reuso de um token antigo **derruba todas as sessões** do usuário |
| Token forjado ou adulterado | JWT assinado (HS256), com emissor, destinatário e validade conferidos; `alg: none` recusado |
| Força bruta | Limite de 10 tentativas de login falhas a cada 15 minutos por IP |
| Descobrir quais e-mails existem | Mesma mensagem e mesmo tempo de resposta para e-mail inexistente ou senha errada |
| Acesso indevido | Todas as rotas exigem login; gestão de usuários só para administradores |
| Senha padrão esquecida | Senhas criadas pelo administrador são **provisórias**: a API bloqueia tudo até a troca |
| Cabeçalhos inseguros | `helmet` na API; CSP, `X-Frame-Options`, `Referrer-Policy` e outros no nginx |

**Primeiro acesso:** se não houver usuários, a API cria um administrador com `ADMIN_EMAIL` e
`ADMIN_PASSWORD` (do arquivo `.env`). Se `ADMIN_PASSWORD` estiver vazio, a senha é gerada e aparece
no log da API (`docker compose logs api`). No primeiro login o sistema exige a troca da senha.

**Login com Google:** só entra quem já foi cadastrado por um administrador (pelo e-mail). O token do
Google é validado na API com a biblioteca oficial (assinatura, destinatário, validade e e-mail
verificado). Para ativar:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto e
   configure a **tela de consentimento OAuth** (tipo "Externo", modo de teste já serve).
2. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**.
3. Em **Origens JavaScript autorizadas**, adicione `http://localhost:3000` e `http://localhost`.
4. Copie o **Client ID** para `GOOGLE_CLIENT_ID` no `.env` e rode `docker compose up -d`.
   O botão "Fazer login com o Google" aparece sozinho na tela de login.

**Variáveis de ambiente** (veja `.env.example`):

| Variável | Para que serve |
| --- | --- |
| `JWT_SECRET` | Segredo que assina os tokens. Use um valor aleatório e longo |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Primeiro administrador (só quando não há usuários) |
| `GOOGLE_CLIENT_ID` | Liga o login com Google |
| `COOKIE_SECURE` | `true` em produção, com HTTPS |

## Documentos (MinIO)

Os arquivos ficam no **MinIO**, um storage compatível com Amazon S3, no bucket `documentos`
(criado automaticamente pela API). No banco fica só o registro do documento: tipo, validade, nome
original, tamanho e o caminho do objeto no storage.

- Tipos disponíveis: **Cartão CNPJ** (padrão), Contrato Social, Inscrição Estadual, Alvará de
  Funcionamento, Certidão Negativa Federal (CND), Certificado de Regularidade do FGTS (CRF),
  Certidão Negativa de Débitos Trabalhistas (CNDT), Comprovante de Endereço, Comprovante Bancário,
  Procuração e **Outros** (com descrição obrigatória).
- Formatos aceitos: PDF, PNG, JPG, WEBP, DOCX e XLSX, até 10 MB.
- O nome do objeto no storage é gerado pela API (nunca o nome enviado pelo usuário).
- Remover um documento também é soft delete: o arquivo continua no storage e pode ser restaurado.
- Anexar, remover e restaurar aparecem no histórico da empresa.
- A lista de empresas avisa quando falta o cartão CNPJ.

O painel web do MinIO fica em http://localhost:9001 (usuário `minioadmin`, senha `minioadmin123`).

> A imagem oficial `minio/minio` deixou de ser publicada no Docker Hub. O projeto usa
> `pgsty/minio`, um fork comunitário mantido que funciona da mesma forma.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19, CSS próprio (sem framework de UI) |
| API | Node.js, Express 5, `pg` |
| Autenticação | JWT (`jsonwebtoken`), scrypt (nativo do Node), Google Identity Services (`google-auth-library`), `helmet`, `express-rate-limit` |
| Banco | PostgreSQL 16 |
| Arquivos | MinIO (compatível com S3), `minio` e `multer` na API |
| Infra | Docker, Docker Compose, Nginx |

## Estrutura

```
├── src/                  # Front-end React
│   ├── cadastros/        # Configuração dos formulários (campos, abas, colunas da lista)
│   ├── paginas/          # Login, painel, listagem, formulário, auditoria e usuários
│   ├── components/       # Componentes reutilizáveis (modal, histórico, campos, ícones)
│   ├── utils/            # Máscaras, validações, formatação e consultas de CEP/CNPJ
│   ├── sessao.js         # Token de acesso em memória e renovação automática
│   └── api.js            # Chamadas à API
├── api/                  # API Node.js/Express
│   ├── server.js         # Configuração, segurança, auditoria e tratamento de erros
│   ├── auth.js           # Login (senha e Google), sessões, renovação e proteção das rotas
│   ├── usuarios.js       # Gestão de usuários (administrador)
│   ├── senhas.js         # Hash e regras de senha (scrypt)
│   ├── tokens.js         # JWT de acesso e refresh tokens
│   ├── test/             # Testes de segurança (node --test)
│   ├── cadastros.js      # Rotas de cadastro (CRUD com soft delete e auditoria)
│   ├── documentos.js     # Rotas de documentos (envio, download, remoção e restauração)
│   ├── storage.js        # Conexão com o MinIO
│   ├── validacoes.js     # Validação dos dados recebidos
│   ├── db.js             # Conexão e execução das migrations
│   ├── util.js           # Funções comuns (transação, auditoria, erros HTTP)
│   └── migrations/       # Scripts SQL de criação e evolução do banco
├── nginx.conf            # Servidor do front (repassa /api para a API)
├── dockerfile            # Imagem do front
└── docker-compose.yml    # Sobe banco, storage, API e front juntos
```

## Como rodar com Docker (recomendado)

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) aberto.

```bash
cp .env.example .env   # defina JWT_SECRET e os dados do primeiro administrador
docker compose up -d --build
```

Depois acesse:

- **Front-end:** http://localhost:3000
- **API:** http://localhost:5000/api/health
- **Banco:** `localhost:5433` (usuário `postgres`, senha `postgres`)
- **MinIO (painel web):** http://localhost:9001 (usuário `minioadmin`, senha `minioadmin123`)

Ao iniciar, a API executa as migrations pendentes da pasta `api/migrations`: as tabelas são criadas
ou atualizadas automaticamente, sem perder dados. Para parar:

```bash
docker compose down
```

Para parar **e apagar os dados** (banco e arquivos): `docker compose down -v`.

## Como rodar sem Docker (desenvolvimento)

1. Crie o banco `cadastros_db` no seu PostgreSQL (as tabelas são criadas pela API ao iniciar).
   Para os anexos, suba só o MinIO com `docker compose up -d minio`.
2. API:
   ```bash
   cd api
   cp .env.example .env   # edite com a senha do seu PostgreSQL
   npm install
   npm run dev
   ```
3. Front-end (em outro terminal, na raiz do projeto):
   ```bash
   npm install
   npm start
   ```
   O front abre em http://localhost:3000 e usa a API em `http://localhost:5000/api`.

## Endpoints da API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/health` | Verifica se a API e o banco estão no ar (público) |
| GET | `/api/auth/config` | Diz se o login com Google está ligado (público) |
| POST | `/api/auth/login` | Login com e-mail e senha (público) |
| POST | `/api/auth/google` | Login com o ID token do Google (público) |
| POST | `/api/auth/renovar` | Troca o refresh token (cookie) por um novo token de acesso |
| POST | `/api/auth/sair` | Encerra a sessão |
| GET | `/api/auth/eu` | Dados do usuário logado |
| POST | `/api/auth/trocar-senha` | Troca a senha do usuário logado |
| GET/POST | `/api/usuarios` | Lista e cria usuários (administrador) |
| PUT | `/api/usuarios/:id` | Edita nome, perfil e situação (administrador) |
| POST | `/api/usuarios/:id/redefinir-senha` | Define uma senha provisória (administrador) |
| GET | `/api/{cadastro}` | Lista ativos (`?status=excluidos` para excluídos) |
| GET | `/api/{cadastro}/:id` | Detalhe |
| GET | `/api/{cadastro}/:id/historico` | Histórico de auditoria do registro |
| POST | `/api/{cadastro}` | Cadastra |
| PUT | `/api/{cadastro}/:id` | Edita |
| DELETE | `/api/{cadastro}/:id` | Exclui (soft delete); corpo: `{ "motivo": "..." }` |
| POST | `/api/{cadastro}/:id/restaurar` | Restaura um registro excluído |
| GET | `/api/empresas/:id/documentos` | Documentos da empresa (`?status=excluidos` para removidos) |
| POST | `/api/empresas/:id/documentos` | Anexa um documento (`multipart/form-data`: `arquivo`, `tipo`, `descricao`, `validade`) |
| GET | `/api/empresas/:id/documentos/:doc/arquivo` | Visualiza o arquivo (`?download=1` para baixar) |
| DELETE | `/api/empresas/:id/documentos/:doc` | Remove o documento (soft delete); corpo: `{ "motivo": "..." }` |
| POST | `/api/empresas/:id/documentos/:doc/restaurar` | Restaura um documento removido |
| GET | `/api/documentos/tipos` | Tipos de documento e formatos aceitos |
| GET | `/api/auditoria` | Todas as ações (filtros: `entidade`, `acao`, `usuario`, `pagina`) |
| GET | `/api/resumo` | Totais exibidos no painel |

`{cadastro}` é `empresas` ou `pessoas`. Fora as rotas públicas, todas exigem
`Authorization: Bearer <token>`.

Respostas de erro: `400` (dados inválidos, com `erros` por campo), `401` (sem login ou token vencido),
`403` (sem permissão ou senha provisória), `404` (não encontrado), `409` (duplicado ou registro excluído),
`429` (muitas tentativas), `500` (erro interno), `503` (storage de arquivos indisponível).

## Testes

```bash
npm test              # front-end
cd api && npm test    # API: testes de segurança (senhas e tokens)
```

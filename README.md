# CadastroHub

[![CI](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml/badge.svg)](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml)

Sistema de cadastro de **empresas** e **pessoas**, com front-end em React, API em Node.js/Express,
banco PostgreSQL e storage de arquivos MinIO, tudo rodando em containers Docker.

## Funcionalidades

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

O operador é identificado no primeiro acesso e enviado à API no cabeçalho `X-Usuario`. Alterações sem
operador são recusadas (`401`).

Hard delete não é usado: todos os dados do sistema hoje são de cadastro e precisam ser rastreáveis.

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
| Banco | PostgreSQL 16 |
| Arquivos | MinIO (compatível com S3), `minio` e `multer` na API |
| Infra | Docker, Docker Compose, Nginx |

## Estrutura

```
├── src/                  # Front-end React
│   ├── cadastros/        # Configuração dos formulários (campos, abas, colunas da lista)
│   ├── paginas/          # Painel, listagem, formulário e auditoria
│   ├── components/       # Componentes reutilizáveis (modal, histórico, campos, ícones)
│   ├── utils/            # Máscaras, validações, formatação e consultas de CEP/CNPJ
│   └── api.js            # Chamadas à API
├── api/                  # API Node.js/Express
│   ├── server.js         # Configuração, auditoria e tratamento de erros
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
| GET | `/api/health` | Verifica se a API e o banco estão no ar |
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

`{cadastro}` é `empresas` ou `pessoas`. Toda alteração exige o cabeçalho `X-Usuario`.

Respostas de erro: `400` (dados inválidos, com `erros` por campo), `401` (operador não informado),
`404` (não encontrado), `409` (CPF/CNPJ duplicado ou registro excluído), `500` (erro interno),
`503` (storage de arquivos indisponível).

## Testes

```bash
npm test
```

# CadastroHub

Sistema de cadastro de **empresas** e **pessoas**, com front-end em React, API em Node.js/Express e banco PostgreSQL, tudo rodando em containers Docker.

## Funcionalidades

- Cadastro e listagem de empresas e pessoas
- Máscaras automáticas para CPF, CNPJ, telefone e CEP
- Validação de CPF e CNPJ pelos dígitos verificadores (no front e na API)
- Preenchimento automático do endereço pelo CEP ([ViaCEP](https://viacep.com.br))
- Busca nas listagens por nome, documento, e-mail ou cidade
- Bloqueio de CPF/CNPJ duplicado
- Layout responsivo (desktop e celular)

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19, Bootstrap 5, CSS próprio |
| API | Node.js, Express 5, `pg` |
| Banco | PostgreSQL 16 |
| Infra | Docker, Docker Compose, Nginx |

## Estrutura

```
├── src/                  # Front-end React
│   ├── components/       # Componentes reutilizáveis (tabela, campos, ícones, avisos)
│   ├── utils/            # Máscaras, validações e formatação
│   └── api.js            # Chamadas à API
├── api/                  # API Node.js/Express
│   ├── server.js         # Rotas
│   └── validacoes.js     # Validação dos dados recebidos
├── db/init.sql           # Criação das tabelas
├── nginx.conf            # Servidor do front (repassa /api para a API)
├── dockerfile            # Imagem do front
└── docker-compose.yml    # Sobe banco, API e front juntos
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

As tabelas são criadas automaticamente na primeira execução. Para parar:

```bash
docker compose down
```

Para parar **e apagar os dados** do banco: `docker compose down -v`.

## Como rodar sem Docker (desenvolvimento)

1. Crie o banco `cadastros_db` no seu PostgreSQL e execute o `db/init.sql`.
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
| GET | `/api/empresas` | Lista empresas |
| POST | `/api/empresas` | Cadastra empresa |
| GET | `/api/pessoas` | Lista pessoas |
| POST | `/api/pessoas` | Cadastra pessoa |

Respostas de erro: `400` (dados inválidos), `409` (CPF/CNPJ já cadastrado), `500` (erro interno).

## Testes

```bash
npm test
```

# CadastroHub

[![CI](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml/badge.svg)](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml)

Sistema web para cadastro de empresas e pessoas. Além dos dados cadastrais, ele guarda os documentos de
cada empresa (cartão CNPJ, contrato social, certidões) e avisa quando algum está vencido ou perto de vencer.

Todo cadastro tem histórico. Dá para ver quem criou, quem alterou e o que mudou em cada registro.

Roda tudo em Docker: o front em React, a API em Node.js, o banco PostgreSQL e o MinIO, onde ficam os
arquivos.

## Objetivo

A ideia é manter o cadastro organizado e rastreável. Nada é apagado de verdade. O que é excluído pode ser
restaurado depois, e toda alteração fica na auditoria com o nome de quem fez.

## Tecnologias

- React 19 e React Router no front-end, com CSS próprio
- Node.js 20 e Express 5 na API
- PostgreSQL 16, com as tabelas criadas por migrations
- MinIO para guardar os arquivos
- JWT e scrypt no login, além do login com Google
- nodemailer para os e-mails pelo Gmail, e Mailpit para testar
- Docker Compose, Nginx e GitHub Actions

## Principais rotinas e integrações

O básico é o cadastro de empresas e pessoas, com validação de CPF, CNPJ, telefone e CEP. A pessoa pode ser
ligada a uma empresa. Quando você digita o CNPJ, o sistema busca os dados da empresa na
[BrasilAPI](https://brasilapi.com.br), e com o CEP ele busca o endereço no [ViaCEP](https://viacep.com.br).

Excluir não apaga o registro do banco (soft delete). Ele vai para o filtro de excluídos e pode ser
restaurado. Cada inclusão, alteração, exclusão e restauração vai para a auditoria, com data, IP e como o
registro estava antes e depois.

Cada empresa pode ter documentos anexados, com data de validade. Os arquivos ficam no MinIO, e o painel
mostra o que venceu e o que vence nos próximos 30 dias.

Para entrar é preciso login, com senha ou com a conta Google. Tem recuperação de senha por e-mail, e o
administrador recebe um código no e-mail a cada login (verificação em duas etapas). Os e-mails saem pelo
Gmail.

Tem também backup automático do banco e dos arquivos uma vez por dia, e a documentação da API com Swagger.

## Instalação

Precisa ter o [Git](https://git-scm.com/downloads) e o
[Docker Desktop](https://www.docker.com/products/docker-desktop/) instalados, com o Docker aberto.

```bash
git clone https://github.com/Geisel-jr/projeto-cadastro.git
cd projeto-cadastro
docker compose up -d --build
```

A primeira vez demora uns minutos por causa do build. Não precisa criar `.env`. Sem ele, o sistema sobe
com a configuração de desenvolvimento, cria um usuário de demonstração e cadastra os dados de exemplo.

Abra http://localhost:3000. O e-mail e a senha do usuário de demonstração estão na própria tela de login.

Sem Gmail configurado, os e-mails não saem de verdade. Eles ficam no Mailpit, em http://localhost:8025, e é
lá que aparecem o link de recuperação de senha e o código dos administradores.

Outros endereços que podem ser úteis:

| Endereço | O que tem |
| --- | --- |
| http://localhost:3000/api/docs | Documentação da API (Swagger), onde dá para testar as rotas |
| http://localhost:8025 | E-mails enviados pelo sistema (Mailpit) |
| http://localhost:9001 | Arquivos no MinIO (usuário `minioadmin`, senha `minioadmin123`) |
| http://localhost:5000/api/health | Mostra se a API e o banco estão funcionando |

Para parar:

```bash
docker compose down      # para o sistema e mantém os dados
docker compose down -v   # para e apaga banco e arquivos (na próxima vez tudo é criado de novo)
```

Para usar o Gmail, o login com Google ou criar outro administrador, copie o `.env.example` para `.env` e
preencha. Está tudo explicado em [docs/seguranca.md](docs/seguranca.md).

## Dados de exemplo (seed)

Na primeira subida, com o banco vazio, a API cadastra 12 empresas, 24 pessoas e 17 documentos. Os dados
são inventados (gerei com IA), mas os CPFs e CNPJs são válidos para passar na validação. Deixei alguns
documentos vencidos de propósito, para o aviso aparecer no painel, e uma empresa e uma pessoa excluídas.

Os dados estão em [`api/seeds/dados-exemplo.json`](api/seeds/dados-exemplo.json), e quem grava é o
[`api/seeds.js`](api/seeds.js). Eles passam pela mesma validação de um cadastro feito pela tela e ficam na
auditoria com o autor "Dados de exemplo". Se o banco já tiver dados, o seed não roda. Para desligar, use
`DADOS_EXEMPLO=false` no `.env`.

### Backup, dump ou seed?

Backup é uma cópia dos dados reais, para recuperar se algo der errado (aqui fica na pasta `backups/`).
Dump é o banco exportado para um arquivo com o `pg_dump`, e é isso que o backup gera. Seed é o nome dado
aos dados que o próprio sistema cadastra para não começar vazio.

Por isso o nome certo aqui é seed. Esses dados não vieram de banco nenhum, foram criados para
demonstração. Um dump também ficaria preso à estrutura do banco do dia em que foi gerado, e o seed passa
pelas migrations e validações de hoje.

## Documentação

- [docs/seguranca.md](docs/seguranca.md): login, sessões, MFA, recuperação de senha, Google e variáveis do `.env`
- [docs/api.md](docs/api.md): lista das rotas da API (a versão interativa fica em http://localhost:3000/api/docs)
- [docs/operacao.md](docs/operacao.md): documentos, backup, como rodar sem Docker, testes e pastas do projeto

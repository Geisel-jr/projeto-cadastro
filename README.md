# CadastroHub

[![CI](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml/badge.svg)](https://github.com/Geisel-jr/projeto-cadastro/actions/workflows/ci.yml)

Sistema para cadastrar empresas e pessoas e guardar os documentos das empresas. Ele avisa quando um
documento está perto de vencer e guarda o histórico de cada cadastro (quem criou, quem alterou, quando
e o que mudou).

O front-end é em React, a API em Node.js, o banco em PostgreSQL e os arquivos ficam no MinIO. Tudo roda
em containers Docker.

## Objetivo

Ter um cadastro de empresas e pessoas em que nada se perde. Um registro excluído continua no banco e
pode ser restaurado, só entra quem tem login e toda alteração fica registrada na auditoria.

## Tecnologias

| Parte | Tecnologia |
| --- | --- |
| Front-end | React 19, React Router 7, CSS próprio |
| API | Node.js 20, Express 5 |
| Banco | PostgreSQL 16, com migrations automáticas |
| Arquivos | MinIO (compatível com Amazon S3) |
| Login e segurança | JWT, scrypt, login com Google, helmet, limite de tentativas |
| E-mail | nodemailer com Gmail; Mailpit para testes |
| Infra | Docker Compose, Nginx, GitHub Actions |

## Principais rotinas e integrações

### Rotinas

- Cadastro de empresas e pessoas, com formulário em abas e validação de CPF, CNPJ, telefone e CEP.
  A pessoa pode ser ligada a uma empresa.
- Exclusão sem apagar do banco (soft delete). O registro sai da lista, mas continua guardado e pode
  ser restaurado.
- Auditoria de tudo o que é feito: quem fez, quando, de qual IP e como o registro estava antes e
  depois. Esses registros não podem ser alterados nem apagados.
- Documentos da empresa (cartão CNPJ, contrato social, certidões etc.) com data de validade. O painel
  mostra o que já venceu e o que vence nos próximos 30 dias.
- Listas paginadas, com ordenação pelas colunas e busca que não diferencia acentos.
- Login com senha ou com Google, com perfil de administrador ou operador. Tem "esqueci minha senha"
  por e-mail, e o administrador recebe um código por e-mail para entrar.
- Backup automático do banco e dos arquivos uma vez por dia.

### Integrações

| Serviço | Para que é usado |
| --- | --- |
| [BrasilAPI](https://brasilapi.com.br) | Busca os dados da empresa pelo CNPJ |
| [ViaCEP](https://viacep.com.br) | Busca o endereço pelo CEP |
| Google | Login com a conta Google (opcional) |
| Gmail | Envio dos e-mails de recuperação de senha e dos códigos de acesso |
| MinIO | Armazenamento dos arquivos dos documentos |

## Instalação

É preciso ter o [Git](https://git-scm.com/downloads) e o
[Docker Desktop](https://www.docker.com/products/docker-desktop/) instalados, com o Docker aberto.

```bash
git clone https://github.com/Geisel-jr/projeto-cadastro.git
cd projeto-cadastro
docker compose up -d --build
```

Na primeira vez demora alguns minutos. Não precisa criar o arquivo `.env`: sem ele, o sistema usa as
configurações de desenvolvimento, cria um usuário de demonstração e já cadastra alguns dados de exemplo.

Depois é só abrir http://localhost:3000. O e-mail e a senha do usuário de demonstração aparecem na
tela de login, basta copiar e colar.

Outros endereços:

| Endereço | O que tem |
| --- | --- |
| http://localhost:8025 | E-mails enviados pelo sistema (Mailpit) |
| http://localhost:9001 | Arquivos no MinIO (usuário `minioadmin`, senha `minioadmin123`) |
| http://localhost:5000/api/health | Se a API e o banco estão funcionando |

Para parar:

```bash
docker compose down      # para o sistema e mantém os dados
docker compose down -v   # para e apaga banco e arquivos (na próxima vez tudo é criado de novo)
```

Para configurar o Gmail, o login com Google ou outro administrador, copie o `.env.example` para `.env`
e preencha. Os detalhes estão em [docs/seguranca.md](docs/seguranca.md).

## Dados de exemplo (seed)

Na primeira vez que o sistema sobe, com o banco vazio, a API cadastra 12 empresas, 24 pessoas e 17
documentos. Os dados são fictícios e foram gerados com IA, mas os CPFs e CNPJs têm dígitos
verificadores válidos. Alguns documentos já estão vencidos ou perto de vencer, para o aviso aparecer no
painel, e há uma empresa e uma pessoa excluídas para testar o filtro de excluídos.

Os dados estão em [`api/seeds/dados-exemplo.json`](api/seeds/dados-exemplo.json) e quem grava é o
[`api/seeds.js`](api/seeds.js). Eles passam pela mesma validação da API e aparecem na auditoria com o
autor "Dados de exemplo". Se o banco já tiver dados, o seed não roda. Para desligar, coloque
`DADOS_EXEMPLO=false` no `.env`.

### Backup, dump ou seed?

- Backup é uma cópia de segurança dos dados reais, para recuperar se algo der errado. Neste projeto
  fica na pasta `backups/`.
- Dump é o banco exportado para um arquivo com o `pg_dump`. Os backups deste projeto são dumps
  (arquivos `.dump`).
- Seed são os dados que o próprio sistema cadastra para não começar vazio.

Aqui o nome certo é seed, porque esses dados não vieram de nenhum banco, foram criados só para
demonstração. Um dump também ficaria com a estrutura do banco do dia em que foi gerado, e o seed
sempre passa pelas migrations e validações atuais.

## Documentação

- [docs/seguranca.md](docs/seguranca.md): login, sessões, MFA, recuperação de senha, Google e variáveis de ambiente
- [docs/api.md](docs/api.md): endpoints da API
- [docs/operacao.md](docs/operacao.md): documentos, backup, como rodar sem Docker, testes e pastas do projeto

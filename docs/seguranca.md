# Segurança e auditoria

[Voltar ao README](../README.md)

## Exclusão e auditoria

Nenhum cadastro é apagado de verdade. Quando alguém exclui um registro, o sistema pede o motivo e só
marca o registro como excluído (colunas `excluido_em`, `excluido_por` e `motivo_exclusao`). Ele continua
aparecendo no filtro "Excluídos" da lista e pode ser restaurado.

Cada ação grava uma linha na tabela `auditoria`, junto com a alteração (na mesma transação), com o
registro como estava antes e como ficou depois. Um trigger no banco impede que essa tabela seja
alterada ou apagada (UPDATE e DELETE são recusados).

O nome de quem fez a ação vem do usuário logado. Logins, saídas, tentativas de login recusadas e trocas
de senha também vão para a auditoria.

O único caso de exclusão de verdade (hard delete) é o das sessões vencidas há mais de 30 dias. Elas não
servem para auditoria, porque os logins já ficam registrados na tabela `auditoria`.

## Dados pessoais (LGPD)

- A lista de pessoas vem da API com o CPF mascarado (`***.456.789-**`) e o RG escondido, menos os dois
  últimos dígitos. A busca por CPF continua funcionando, porque ela é feita no banco.
- O CPF completo só vem quando alguém abre o cadastro da pessoa. Cada abertura vira uma linha
  `VISUALIZAR` na auditoria, com quem abriu, quando e de qual IP. Abrir o mesmo cadastro de novo em
  menos de 10 minutos não gera outra linha.
- Essas aberturas aparecem no histórico de cada pessoa. Na tela Auditoria, só quando o filtro
  "Visualização de dados pessoais" é escolhido, para não tomar a linha do tempo.
- Exportar uma lista em planilha também fica na auditoria (`EXPORTAR`), com quantos registros saíram e
  qual busca estava aplicada, porque a planilha leva os dados completos para fora do sistema.

## Como funciona o login

1. Quando a pessoa entra (com senha ou Google), a API devolve um token de acesso (JWT) que vale 15
   minutos e grava um refresh token num cookie.
2. O front guarda o token de acesso só na memória, nunca no `localStorage`, e manda ele em toda
   requisição no cabeçalho `Authorization: Bearer <token>`.
3. Perto do token vencer, o front chama `/api/auth/renovar`. A API confere o cookie, troca o refresh
   token por um novo e devolve outro token de acesso. É assim também que a sessão volta quando a página
   é recarregada, sem pedir login de novo.

## Proteções

| Risco | O que o sistema faz |
| --- | --- |
| Vazamento das senhas do banco | Senhas guardadas com hash scrypt (parâmetros da OWASP: N=2^17, r=8, p=1) e sal aleatório |
| Roubo do token por XSS | Token de acesso só na memória, refresh token em cookie httpOnly e CSP no nginx |
| CSRF | Cookie SameSite=Strict, só para `/api/auth`, e cabeçalho `X-Requested-With` obrigatório |
| Token roubado usado de novo | O refresh token muda a cada uso; se um token antigo aparecer, todas as sessões do usuário caem |
| Token falso ou alterado | JWT assinado (HS256), com emissor, destinatário e validade conferidos; `alg: none` é recusado |
| Força bruta | No máximo 10 tentativas de login erradas a cada 15 minutos por IP |
| Senha de administrador vazada | Verificação em duas etapas: só a senha não basta, precisa do código enviado por e-mail |
| Descobrir quais e-mails têm conta | A mensagem e o tempo de resposta são os mesmos para e-mail que não existe e senha errada |
| Acesso sem permissão | Todas as rotas exigem login; a gestão de usuários é só para administradores |
| Senha padrão que ninguém troca | Senha criada pelo administrador é provisória e a API bloqueia tudo até ela ser trocada |
| Cabeçalhos inseguros | `helmet` na API; CSP, `X-Frame-Options`, `Referrer-Policy` e outros no nginx |

## Primeiro acesso

Na primeira vez que o sistema sobe, com o banco sem usuários, a API cria o primeiro usuário.

- Se `ADMIN_EMAIL` estiver vazio (o padrão), cria o usuário de demonstração `demo@cadastrohub.local`,
  senha `Demo@2026`, com perfil de administrador. A tela de login mostra o e-mail e a senha para a
  pessoa copiar e colar; o formulário não é preenchido sozinho. Os dados somem da tela quando a senha
  dessa conta é trocada. Essa conta não pede o código de acesso, já que a senha é pública e o e-mail
  não existe.
- Se `ADMIN_EMAIL` estiver preenchido, cria um administrador com a senha de `ADMIN_PASSWORD`. Se a senha
  ficar vazia, a API gera uma e mostra no log (`docker compose logs api`). Essa senha é provisória e o
  sistema pede a troca no primeiro login.

## Esqueci minha senha

Na tela de login, a pessoa informa o e-mail e recebe um link para criar uma senha nova.

- A tela responde sempre a mesma coisa, tendo conta ou não, e o pedido é processado em segundo plano.
  Assim ninguém consegue descobrir quais e-mails estão cadastrados, nem pelo tempo de resposta.
- O link tem um código aleatório que só pode ser usado uma vez e vale 30 minutos. O banco guarda só o
  hash desse código, e um pedido novo cancela os anteriores.
- O endereço do link vem da variável `APP_URL`, nunca do cabeçalho da requisição. Isso evita que alguém
  faça o link do e-mail apontar para um site falso.
- Quando a pessoa abre o link, o código sai da barra de endereço. Depois de salvar a senha nova, todas
  as sessões da conta caem e chega um e-mail avisando da troca.
- O pedido e a troca ficam na auditoria, e há um limite de pedidos por IP.

No Docker, os e-mails vão para o Mailpit (http://localhost:8025), que mostra o que a API enviou sem
entregar para ninguém. Para enviar de verdade, configure um servidor SMTP no `.env` (`SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` e `SMTP_FROM`) e coloque em `APP_URL` o endereço
público do sistema.

## Verificação em duas etapas (administradores)

Depois da senha certa, a API manda um código de 6 números para o e-mail do administrador e só libera a
entrada quando ele digita o código.

- O código vale 10 minutos e só funciona uma vez. Depois de 5 códigos errados, é preciso entrar com a
  senha de novo. Cada usuário pode fazer no máximo 5 logins com senha certa a cada 15 minutos.
- O navegador recebe um "desafio" aleatório, não o código. O banco guarda o hash do desafio e um HMAC do
  código, feito com o segredo do servidor. Quem conseguir ler a tabela não consegue testar o milhão de
  códigos possíveis.
- Dá para pedir outro código a cada 30 segundos, até 2 vezes. O código anterior para de funcionar.
- Trocar a senha, desativar a conta ou mudar o e-mail cancela os códigos que ainda estavam valendo.
- Código errado aparece na auditoria como login recusado.
- O login com Google não pede código, porque o código iria para a mesma conta Google que acabou de
  entrar. Nesse caso quem cuida da verificação em duas etapas é o próprio Google.
- O administrador precisa ter um e-mail de verdade. O e-mail de um usuário pode ser corrigido em
  Usuários > Editar. Numa emergência, `MFA_ADMIN=false` no `.env` desliga a verificação.

## Login com Google

Só entra quem já foi cadastrado por um administrador, pelo e-mail. A API confere o token do Google com
a biblioteca oficial (assinatura, destinatário, validade e se o e-mail é verificado). Para ligar:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto e
   configure a tela de consentimento OAuth (tipo "Externo"; o modo de teste já serve).
2. Em Credenciais > Criar credenciais > ID do cliente OAuth, escolha "Aplicativo da Web".
3. Em "Origens JavaScript autorizadas", adicione `http://localhost:3000` e `http://localhost`.
4. Copie o Client ID para `GOOGLE_CLIENT_ID` no `.env` e rode `docker compose up -d`. O botão "Fazer
   login com o Google" aparece na tela de login.

## Variáveis de ambiente

Todas estão no `.env.example`.

| Variável | Para que serve |
| --- | --- |
| `JWT_SECRET` | Segredo que assina os tokens. Vazio = o sistema gera um na primeira vez e guarda no banco. Em produção, defina um valor aleatório e longo (assim ele não fica no backup) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Primeiro usuário, criado só com o banco vazio. Vazio = usuário de demonstração |
| `DADOS_EXEMPLO` | `true` (padrão): cadastra os dados de exemplo na primeira vez |
| `GOOGLE_CLIENT_ID` | Liga o login com Google |
| `COOKIE_SECURE` | `true` em produção, com HTTPS |
| `MFA_ADMIN` | `true` (padrão): administrador confirma o login com código por e-mail |
| `APP_URL` | Endereço público do sistema, usado nos links dos e-mails |
| `SMTP_*` | Servidor de e-mail (vazio = Mailpit) |
| `AVISO_VENCIMENTOS` | `true` (padrão): e-mail semanal de documentos vencendo para os administradores |
| `AVISO_VENCIMENTOS_DIA` / `AVISO_VENCIMENTOS_HORA` | Dia da semana (0 = domingo, 1 = segunda...) e hora do aviso |
| `FUSO_HORARIO` | Fuso usado no aviso semanal, nas datas das planilhas e nos nomes dos backups |

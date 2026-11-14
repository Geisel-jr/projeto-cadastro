# Endpoints da API

[Voltar ao README](../README.md)

Com o sistema rodando, a documentação interativa (Swagger) fica em http://localhost:3000/api/docs. Lá dá
para testar cada rota: faça o login em `POST /auth/login`, copie o `tokenAcesso` e cole em "Authorize".

`{cadastro}` pode ser `empresas` ou `pessoas`. As rotas marcadas como públicas funcionam sem login; as
outras precisam do cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/health` | Diz se a API e o banco estão funcionando (pública) |
| GET | `/api/auth/config` | Diz se o login com Google está ligado e traz o usuário de demonstração, se ele existir (pública) |
| POST | `/api/auth/login` | Login com e-mail e senha (pública). Para administrador, devolve `{ mfa: { desafio, ... } }` |
| POST | `/api/auth/mfa` | Termina o login com `{ desafio, codigo }` (pública) |
| POST | `/api/auth/mfa/reenviar` | Manda outro código para o mesmo desafio (pública) |
| POST | `/api/auth/google` | Login com o token do Google (pública) |
| POST | `/api/auth/renovar` | Troca o refresh token do cookie por um novo token de acesso |
| POST | `/api/auth/sair` | Sai do sistema |
| GET | `/api/auth/eu` | Dados do usuário logado |
| POST | `/api/auth/trocar-senha` | Troca a senha do usuário logado |
| POST | `/api/auth/esqueci` | Pede o link para criar uma senha nova (pública; a resposta é sempre a mesma) |
| POST | `/api/auth/redefinir/verificar` | Confere se o código do link vale (pública) |
| POST | `/api/auth/redefinir` | Cria a senha nova com o código do link (pública) |
| GET/POST | `/api/usuarios` | Lista e cadastra usuários (administrador) |
| PUT | `/api/usuarios/:id` | Altera nome, e-mail, perfil e se está ativo (administrador) |
| POST | `/api/usuarios/:id/redefinir-senha` | Define uma senha provisória (administrador) |
| GET | `/api/{cadastro}` | Lista com páginas: `?status=excluidos&q=texto&pagina=1&limite=20&ordem=nome&direcao=asc`. Devolve `{ itens, total, pagina, paginas, limite }` |
| GET | `/api/empresas/opcoes` | Id e nome das empresas ativas (usado no campo de empresa da pessoa) |
| GET | `/api/{cadastro}/:id` | Um registro |
| GET | `/api/{cadastro}/:id/historico` | Histórico do registro na auditoria |
| POST | `/api/{cadastro}` | Cadastra |
| PUT | `/api/{cadastro}/:id` | Altera |
| DELETE | `/api/{cadastro}/:id` | Exclui sem apagar (soft delete); corpo: `{ "motivo": "..." }` |
| POST | `/api/{cadastro}/:id/restaurar` | Restaura um registro excluído |
| GET | `/api/empresas/:id/documentos` | Documentos da empresa (`?status=excluidos` para os removidos) |
| POST | `/api/empresas/:id/documentos` | Anexa um documento (`multipart/form-data` com `arquivo`, `tipo`, `descricao` e `validade`) |
| GET | `/api/empresas/:id/documentos/:doc/arquivo` | Abre o arquivo (`?download=1` para baixar) |
| DELETE | `/api/empresas/:id/documentos/:doc` | Remove o documento sem apagar; corpo: `{ "motivo": "..." }` |
| POST | `/api/empresas/:id/documentos/:doc/restaurar` | Restaura um documento removido |
| GET | `/api/documentos/tipos` | Tipos de documento e formatos aceitos |
| GET | `/api/documentos/vencimentos` | Documentos vencidos ou perto de vencer (`?dias=30`, de 1 a 365) |
| GET | `/api/auditoria` | Todas as ações (filtros: `entidade`, `acao`, `usuario`, `pagina`) |
| GET | `/api/resumo` | Números mostrados no painel |

## Códigos de erro

| Código | Quando acontece |
| --- | --- |
| 400 | Dados inválidos (a resposta traz `erros` com o problema de cada campo) |
| 401 | Sem login ou token vencido |
| 403 | Sem permissão, ou senha provisória que ainda não foi trocada |
| 404 | Registro não encontrado |
| 409 | Registro duplicado ou excluído |
| 410 | Código de acesso expirado (é preciso entrar de novo) |
| 429 | Tentativas demais |
| 500 | Erro interno |
| 503 | MinIO ou envio de e-mail fora do ar |

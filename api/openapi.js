const { version } = require('./package.json');
const { REGRAS_EMPRESA, REGRAS_PESSOA } = require('./validacoes');
const { TIPOS_DOCUMENTO } = require('./documentos');

// Descrição da API no formato OpenAPI 3, mostrada pelo Swagger em /api/docs.
// Os campos de empresa e pessoa saem das mesmas regras de validação da API,
// então a documentação não fica desatualizada quando um campo muda.

const FORMATOS = {
  cnpj: { type: 'string', description: 'CNPJ, com ou sem pontuação', example: '11.222.333/0001-81' },
  cpf: { type: 'string', description: 'CPF, com ou sem pontuação', example: '529.982.247-25' },
  cep: { type: 'string', description: 'CEP, com ou sem traço', example: '01001-000' },
  telefone: { type: 'string', description: 'DDD + número', example: '(11) 98888-7777' },
  email: { type: 'string', format: 'email' },
  data: { type: 'string', format: 'date', description: 'AAAA-MM-DD, não pode ser no futuro' },
  uf: { type: 'string', minLength: 2, maxLength: 2, example: 'SP' },
  inteiro: { type: 'integer', minimum: 1 },
};

function schemaDasRegras(regras) {
  const properties = {};
  for (const regra of regras) {
    const campo = { ...(FORMATOS[regra.tipo] || { type: 'string' }) };
    if (regra.max) campo.maxLength = regra.max;
    if (regra.opcoes) campo.enum = regra.opcoes;
    properties[regra.campo] = campo;
  }
  return {
    type: 'object',
    required: regras.filter((r) => r.obrigatorio).map((r) => r.campo),
    properties,
  };
}

const json = (schema) => ({ content: { 'application/json': { schema } } });
const ok = (descricao, schema) => ({ description: descricao, ...(schema && json(schema)) });
const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const erros = (...codigos) => Object.fromEntries(codigos.map((c) => [c, { $ref: `#/components/responses/Erro${c}` }]));
const corpo = (schema) => ({ required: true, ...json(schema) });
const id = (nome = 'id', descricao = 'ID do registro') => ({ name: nome, in: 'path', required: true, schema: { type: 'integer' }, description: descricao });
const publica = { security: [] };
const comMotivo = corpo({ type: 'object', required: ['motivo'], properties: { motivo: { type: 'string', minLength: 3, maxLength: 500 } } });

const LOGIN_OK = {
  type: 'object',
  description: 'Usuário comum recebe a sessão. Administrador recebe `mfa` e precisa confirmar o código em /auth/mfa.',
  properties: {
    tokenAcesso: { type: 'string', description: 'JWT para o botão Authorize (vale 15 minutos)' },
    usuario: ref('Usuario'),
    mfa: {
      type: 'object',
      properties: {
        desafio: { type: 'string' },
        email: { type: 'string', example: 'ad***@empresa.com' },
        minutos: { type: 'integer', example: 10 },
        reenviarEm: { type: 'integer', example: 30 },
        reenvios: { type: 'integer', example: 2 },
      },
    },
  },
};

// CRUD com soft delete, igual para empresas e pessoas
function rotasCadastro(entidade, singular, schema) {
  const tag = entidade === 'empresas' ? 'Empresas' : 'Pessoas';
  return {
    [`/${entidade}`]: {
      get: {
        tags: [tag], summary: `Lista ${entidade} (paginado)`,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ativos', 'excluidos'] } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Busca (ignora acentos; CPF/CNPJ com ou sem pontuação)' },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'ordem', in: 'query', schema: { type: 'string' }, description: 'Coluna de ordenação (ex: nome, criado)' },
          { name: 'direcao', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: { 200: ok('Página da lista', ref('ListaPaginada')), ...erros(401) },
      },
      post: {
        tags: [tag], summary: `Cadastra ${singular}`, requestBody: corpo(schema),
        responses: { 201: ok('Registro criado', schema), ...erros(400, 401, 409) },
      },
    },
    [`/${entidade}/{id}`]: {
      get: { tags: [tag], summary: `Detalhe de ${singular}`, parameters: [id()], responses: { 200: ok('Registro', schema), ...erros(401, 404) } },
      put: {
        tags: [tag], summary: `Altera ${singular}`, parameters: [id()], requestBody: corpo(schema),
        responses: { 200: ok('Registro alterado', schema), ...erros(400, 401, 404, 409) },
      },
      delete: {
        tags: [tag], summary: `Exclui ${singular} sem apagar do banco (soft delete)`, parameters: [id()], requestBody: comMotivo,
        responses: { 200: ok('Registro marcado como excluído'), ...erros(400, 401, 404, 409) },
      },
    },
    [`/${entidade}/{id}/restaurar`]: {
      post: { tags: [tag], summary: `Restaura ${singular} excluído(a)`, parameters: [id()], responses: { 200: ok('Registro restaurado'), ...erros(401, 404, 409) } },
    },
    [`/${entidade}/{id}/historico`]: {
      get: {
        tags: [tag], summary: 'Histórico do registro na auditoria', parameters: [id()],
        responses: { 200: ok('Ações registradas', { type: 'array', items: ref('Auditoria') }), ...erros(401, 404) },
      },
    },
  };
}

const ERROS = {
  400: 'Dados inválidos (veja `erros` para o problema de cada campo)',
  401: 'Sem login, token vencido ou credenciais erradas',
  403: 'Sem permissão, ou senha provisória que ainda não foi trocada',
  404: 'Registro não encontrado',
  409: 'Registro duplicado ou excluído',
  410: 'Código de acesso expirado: é preciso entrar de novo',
  429: 'Tentativas demais',
  503: 'MinIO ou envio de e-mail fora do ar',
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'CadastroHub API',
    version,
    description: [
      'API de cadastro de empresas, pessoas e documentos, com auditoria.',
      '',
      '**Como testar aqui:** abra `POST /auth/login`, clique em *Try it out* e entre com o usuário de',
      'demonstração (aparece na tela de login do sistema). Copie o `tokenAcesso` da resposta, clique em',
      '**Authorize** no topo da página e cole o token. Ele vale 15 minutos.',
      '',
      'Administradores (fora a conta de demonstração) recebem um código por e-mail depois da senha. No',
      'Docker, os e-mails aparecem no Mailpit: http://localhost:8025.',
    ].join('\n'),
  },
  servers: [{ url: '/api' }],
  security: [{ bearer: [] }],
  tags: [
    { name: 'Acesso', description: 'Login, sessão e senha' },
    { name: 'Empresas' }, { name: 'Pessoas' },
    { name: 'Documentos', description: 'Arquivos das empresas, guardados no MinIO' },
    { name: 'Usuários', description: 'Só administradores' },
    { name: 'Sistema' },
  ],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    responses: Object.fromEntries(Object.entries(ERROS).map(([codigo, descricao]) => [`Erro${codigo}`, ok(descricao, ref('Erro'))])),
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Verifique os campos destacados.' },
          erros: { type: 'object', additionalProperties: { type: 'string' }, example: { cnpj: 'CNPJ inválido.' } },
        },
      },
      Empresa: schemaDasRegras(REGRAS_EMPRESA),
      Pessoa: schemaDasRegras(REGRAS_PESSOA),
      ListaPaginada: {
        type: 'object',
        properties: {
          itens: { type: 'array', items: { type: 'object' } },
          total: { type: 'integer' }, pagina: { type: 'integer' }, paginas: { type: 'integer' }, limite: { type: 'integer' },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, nome: { type: 'string' }, email: { type: 'string' },
          papel: { type: 'string', enum: ['admin', 'operador'] },
          temSenha: { type: 'boolean' }, temGoogle: { type: 'boolean' }, deveTrocarSenha: { type: 'boolean' },
        },
      },
      Auditoria: {
        type: 'object',
        properties: {
          acao: { type: 'string', example: 'EDITAR' }, usuario: { type: 'string' }, data: { type: 'string', format: 'date-time' },
          dadosAnteriores: { type: 'object' }, dadosNovos: { type: 'object' }, motivo: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': { get: { tags: ['Sistema'], summary: 'Diz se a API e o banco estão funcionando', ...publica, responses: { 200: ok('Tudo certo') } } },

    '/auth/config': { get: { tags: ['Acesso'], summary: 'Login com Google ligado? Dados da conta de demonstração, se existir', ...publica, responses: { 200: ok('Configuração da tela de login') } } },
    '/auth/login': {
      post: {
        tags: ['Acesso'], summary: 'Login com e-mail e senha', ...publica,
        requestBody: corpo({ type: 'object', required: ['email', 'senha'], properties: { email: { type: 'string', example: 'demo@cadastrohub.local' }, senha: { type: 'string', example: 'Demo@2026' } } }),
        responses: { 200: ok('Sessão criada, ou pedido do código de acesso', LOGIN_OK), ...erros(400, 401, 429, 503) },
      },
    },
    '/auth/mfa': {
      post: {
        tags: ['Acesso'], summary: 'Confirma o código de acesso enviado por e-mail (administradores)', ...publica,
        requestBody: corpo({ type: 'object', required: ['desafio', 'codigo'], properties: { desafio: { type: 'string' }, codigo: { type: 'string', example: '123456' } } }),
        responses: { 200: ok('Sessão criada', LOGIN_OK), ...erros(401, 410, 429) },
      },
    },
    '/auth/mfa/reenviar': {
      post: {
        tags: ['Acesso'], summary: 'Envia outro código para o mesmo desafio', ...publica,
        requestBody: corpo({ type: 'object', required: ['desafio'], properties: { desafio: { type: 'string' } } }),
        responses: { 200: ok('Código enviado'), ...erros(410, 429, 503) },
      },
    },
    '/auth/google': {
      post: {
        tags: ['Acesso'], summary: 'Login com o token do Google', ...publica,
        requestBody: corpo({ type: 'object', required: ['credencial'], properties: { credencial: { type: 'string' } } }),
        responses: { 200: ok('Sessão criada', LOGIN_OK), ...erros(400, 401, 403, 404) },
      },
    },
    '/auth/renovar': { post: { tags: ['Acesso'], summary: 'Novo token de acesso a partir do cookie (usado pelo front)', ...publica, responses: { 200: ok('Token renovado', LOGIN_OK), ...erros(401, 403) } } },
    '/auth/sair': { post: { tags: ['Acesso'], summary: 'Encerra a sessão do cookie', ...publica, responses: { 204: ok('Sessão encerrada') } } },
    '/auth/eu': { get: { tags: ['Acesso'], summary: 'Dados do usuário logado', responses: { 200: ok('Usuário', ref('Usuario')), ...erros(401) } } },
    '/auth/trocar-senha': {
      post: {
        tags: ['Acesso'], summary: 'Troca a senha do usuário logado',
        requestBody: corpo({ type: 'object', required: ['novaSenha'], properties: { senhaAtual: { type: 'string' }, novaSenha: { type: 'string', minLength: 8 } } }),
        responses: { 200: ok('Senha trocada (devolve um token novo)', LOGIN_OK), ...erros(400, 401) },
      },
    },
    '/auth/esqueci': {
      post: {
        tags: ['Acesso'], summary: 'Pede o link para criar uma senha nova', ...publica,
        description: 'A resposta é sempre a mesma, tendo conta ou não. O link chega por e-mail.',
        requestBody: corpo({ type: 'object', required: ['email'], properties: { email: { type: 'string' } } }),
        responses: { 202: ok('Pedido recebido'), ...erros(400, 429) },
      },
    },
    '/auth/redefinir/verificar': {
      post: {
        tags: ['Acesso'], summary: 'Confere se o código do link vale', ...publica,
        requestBody: corpo({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }),
        responses: { 200: ok('Link válido (devolve o e-mail mascarado)'), ...erros(400, 429) },
      },
    },
    '/auth/redefinir': {
      post: {
        tags: ['Acesso'], summary: 'Cria a senha nova com o código do link', ...publica,
        requestBody: corpo({ type: 'object', required: ['token', 'novaSenha'], properties: { token: { type: 'string' }, novaSenha: { type: 'string', minLength: 8 } } }),
        responses: { 200: ok('Senha criada'), ...erros(400, 429) },
      },
    },

    ...rotasCadastro('empresas', 'empresa', ref('Empresa')),
    '/empresas/opcoes': { get: { tags: ['Empresas'], summary: 'Id e nome das empresas ativas (campo de empresa da pessoa)', responses: { 200: ok('Lista curta'), ...erros(401) } } },
    ...rotasCadastro('pessoas', 'pessoa', ref('Pessoa')),

    '/empresas/{id}/documentos': {
      get: {
        tags: ['Documentos'], summary: 'Documentos da empresa',
        parameters: [id('id', 'ID da empresa'), { name: 'status', in: 'query', schema: { type: 'string', enum: ['ativos', 'excluidos'] } }],
        responses: { 200: ok('Documentos'), ...erros(401, 404) },
      },
      post: {
        tags: ['Documentos'], summary: 'Anexa um documento (até 10 MB)', parameters: [id('id', 'ID da empresa')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object', required: ['arquivo', 'tipo'],
                properties: {
                  arquivo: { type: 'string', format: 'binary', description: 'PDF, PNG, JPG, WEBP, DOCX ou XLSX' },
                  tipo: { type: 'string', enum: TIPOS_DOCUMENTO },
                  descricao: { type: 'string', description: 'Obrigatória quando o tipo é "Outros"' },
                  validade: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Documento anexado'), ...erros(400, 401, 404, 409, 503) },
      },
    },
    '/empresas/{id}/documentos/{doc}/arquivo': {
      get: {
        tags: ['Documentos'], summary: 'Abre o arquivo (`?download=1` para baixar)',
        parameters: [id('id', 'ID da empresa'), id('doc', 'ID do documento'), { name: 'download', in: 'query', schema: { type: 'string', enum: ['1'] } }],
        responses: { 200: { description: 'O arquivo' }, ...erros(401, 404, 503) },
      },
    },
    '/empresas/{id}/documentos/{doc}': {
      delete: {
        tags: ['Documentos'], summary: 'Remove o documento sem apagar o arquivo',
        parameters: [id('id', 'ID da empresa'), id('doc', 'ID do documento')], requestBody: comMotivo,
        responses: { 200: ok('Documento removido'), ...erros(400, 401, 404) },
      },
    },
    '/empresas/{id}/documentos/{doc}/restaurar': {
      post: {
        tags: ['Documentos'], summary: 'Restaura um documento removido',
        parameters: [id('id', 'ID da empresa'), id('doc', 'ID do documento')],
        responses: { 200: ok('Documento restaurado'), ...erros(401, 404) },
      },
    },
    '/documentos/tipos': { get: { tags: ['Documentos'], summary: 'Tipos de documento e formatos aceitos', responses: { 200: ok('Tipos e formatos'), ...erros(401) } } },
    '/documentos/vencimentos': {
      get: {
        tags: ['Documentos'], summary: 'Documentos vencidos ou perto de vencer',
        parameters: [{ name: 'dias', in: 'query', schema: { type: 'integer', default: 30, minimum: 1, maximum: 365 } }],
        responses: { 200: ok('Vencidos e a vencer'), ...erros(401) },
      },
    },

    '/usuarios': {
      get: { tags: ['Usuários'], summary: 'Lista os usuários', responses: { 200: ok('Usuários', { type: 'array', items: ref('Usuario') }), ...erros(401, 403) } },
      post: {
        tags: ['Usuários'], summary: 'Cadastra um usuário (sem senha = só login com Google)',
        requestBody: corpo({ type: 'object', required: ['nome', 'email'], properties: { nome: { type: 'string' }, email: { type: 'string' }, papel: { type: 'string', enum: ['admin', 'operador'] }, senha: { type: 'string', description: 'Provisória: a pessoa troca no primeiro login' } } }),
        responses: { 201: ok('Usuário criado', ref('Usuario')), ...erros(400, 401, 403, 409) },
      },
    },
    '/usuarios/{id}': {
      put: {
        tags: ['Usuários'], summary: 'Altera nome, e-mail, perfil e se está ativo', parameters: [id()],
        requestBody: corpo({ type: 'object', required: ['nome', 'email'], properties: { nome: { type: 'string' }, email: { type: 'string' }, papel: { type: 'string', enum: ['admin', 'operador'] }, ativo: { type: 'boolean' } } }),
        responses: { 200: ok('Usuário alterado', ref('Usuario')), ...erros(400, 401, 403, 404, 409) },
      },
    },
    '/usuarios/{id}/redefinir-senha': {
      post: {
        tags: ['Usuários'], summary: 'Define uma senha provisória', parameters: [id()],
        requestBody: corpo({ type: 'object', required: ['senha'], properties: { senha: { type: 'string', minLength: 8 } } }),
        responses: { 204: ok('Senha definida'), ...erros(400, 401, 403, 404) },
      },
    },

    '/auditoria': {
      get: {
        tags: ['Sistema'], summary: 'Todas as ações registradas',
        parameters: ['entidade', 'acao', 'usuario'].map((nome) => ({ name: nome, in: 'query', schema: { type: 'string' } }))
          .concat({ name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } }),
        responses: { 200: ok('Ações'), ...erros(401) },
      },
    },
    '/resumo': { get: { tags: ['Sistema'], summary: 'Números do painel', responses: { 200: ok('Totais'), ...erros(401) } } },
  },
};

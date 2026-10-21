import { useCallback, useEffect, useState } from 'react';
import { mensagemErro, usuarios as apiUsuarios } from '../api';
import Campo from '../components/Campo';
import Icone from '../components/Icone';
import Modal from '../components/Modal';
import { Avatar } from '../components/MenuUsuario';
import { formatarDataHora } from '../utils/formatadores';

const PAPEIS = { admin: 'Administrador', operador: 'Operador' };

// Senha provisória aleatória (o usuário troca no primeiro acesso)
function gerarSenha() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const todos = letras + numeros;
  const aleatorio = (texto) => texto[crypto.getRandomValues(new Uint32Array(1))[0] % texto.length];
  const base = Array.from({ length: 10 }, () => aleatorio(todos)).join('');
  return base + aleatorio(letras) + aleatorio(numeros);
}

function descreverAcesso(u) {
  if (u.temSenha && u.temGoogle) return 'Senha e Google';
  if (u.temGoogle) return 'Google';
  if (u.temSenha) return 'Senha';
  return 'Google (aguardando o 1º acesso)';
}

// Gestão de usuários (somente administradores)
export default function Usuarios({ usuarioAtual, notificar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [editando, setEditando] = useState(null); // {} = novo usuário
  const [redefinindo, setRedefinindo] = useState(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setLista(await apiUsuarios.listar());
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aoSalvar = (mensagem) => {
    notificar('sucesso', mensagem);
    setEditando(null);
    setRedefinindo(null);
    carregar();
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Usuários</h1>
        <button className="btn btn-primario" onClick={() => setEditando({})}>
          <Icone nome="mais" tamanho={16} /> Novo usuário
        </button>
      </div>

      <div className="painel">
        {erro ? (
          <div className="estado">
            <span className="estado-icone erro"><Icone nome="alerta" tamanho={24} /></span>
            <p>{erro}</p>
            <button className="btn btn-secundario btn-pequeno" onClick={carregar}>Tentar novamente</button>
          </div>
        ) : !lista ? (
          <div className="esqueleto" aria-label="Carregando">
            {[56, 44, 62].map((largura, i) => (
              <div className="esqueleto-linha" key={i}>
                <span className="esq circulo" /><span className="esq" style={{ width: `${largura}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>Acesso</th>
                  <th>Último login</th>
                  <th>Situação</th>
                  <th className="coluna-acoes"><span className="visualmente-oculto">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className={u.ativo ? '' : 'linha-inativa'}>
                    <td>
                      <div className="celula-nome">
                        <Avatar usuario={u} />
                        <div>
                          <strong>{u.nome}{u.id === usuarioAtual.id && <span className="texto-suave"> (você)</span>}</strong>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{PAPEIS[u.papel]}</td>
                    <td>{descreverAcesso(u)}{u.deveTrocarSenha && <small className="texto-alerta d-bloco">Senha provisória</small>}</td>
                    <td>{u.ultimoLoginEm ? formatarDataHora(u.ultimoLoginEm) : <span className="texto-suave">Nunca</span>}</td>
                    <td><span className={`selo ${u.ativo ? 'sucesso' : ''}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="coluna-acoes">
                      <div className="acoes">
                        <button className="btn-acao" onClick={() => setEditando(u)} title="Editar" aria-label={`Editar ${u.nome}`}>
                          <Icone nome="editar" tamanho={17} />
                        </button>
                        <button className="btn-acao" onClick={() => setRedefinindo(u)} title="Definir senha provisória" aria-label={`Definir senha de ${u.nome}`}>
                          <Icone nome="chave" tamanho={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <ModalUsuario
          usuario={editando}
          proprio={editando.id === usuarioAtual.id}
          onFechar={() => setEditando(null)}
          onSalvo={aoSalvar}
        />
      )}
      {redefinindo && (
        <ModalRedefinir usuario={redefinindo} onFechar={() => setRedefinindo(null)} onSalvo={aoSalvar} />
      )}
    </>
  );
}

function ModalUsuario({ usuario, proprio, onFechar, onSalvo }) {
  const novo = !usuario.id;
  const [dados, setDados] = useState({
    nome: usuario.nome || '',
    email: usuario.email || '',
    papel: usuario.papel || 'operador',
    ativo: usuario.ativo ?? true,
    senha: '',
  });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const alterar = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    setErros((x) => ({ ...x, [campo]: undefined }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      if (novo) await apiUsuarios.criar(dados);
      else await apiUsuarios.atualizar(usuario.id, { nome: dados.nome, papel: dados.papel, ativo: dados.ativo });
      onSalvo(novo ? 'Usuário cadastrado' : 'Usuário atualizado');
    } catch (err) {
      setErros(err.campos || { geral: mensagemErro(err) });
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={novo ? 'Novo usuário' : 'Editar usuário'}
      onFechar={enviando ? undefined : onFechar}
      rodape={(fechar) => (
        <>
          <button className="btn btn-secundario" onClick={fechar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-primario" type="submit" form="form-usuario" disabled={enviando}>
            {enviando && <span className="spinner" />} Salvar
          </button>
        </>
      )}
    >
      <form id="form-usuario" onSubmit={salvar} className="form-senha" noValidate>
        {erros.geral && <div className="aviso aviso-erro" role="alert"><Icone nome="alerta" /><span className="aviso-texto">{erros.geral}</span></div>}
        <Campo id="usuario-nome" label="Nome" obrigatorio erro={erros.nome}>
          <input id="usuario-nome" className={`entrada ${erros.nome ? 'invalida' : ''}`} value={dados.nome}
            onChange={alterar('nome')} maxLength={100} autoFocus />
        </Campo>
        <Campo id="usuario-email" label="E-mail" obrigatorio={novo} erro={erros.email}
          ajuda={novo ? 'Também é o e-mail usado no login com Google.' : null}>
          <input id="usuario-email" type="email" className={`entrada ${erros.email ? 'invalida' : ''}`} value={dados.email}
            onChange={alterar('email')} maxLength={150} disabled={!novo} />
        </Campo>
        <Campo id="usuario-papel" label="Perfil" erro={erros.papel}
          ajuda={dados.papel === 'admin' ? 'Pode gerenciar usuários.' : 'Pode cadastrar e editar empresas, pessoas e documentos.'}>
          <select id="usuario-papel" className="entrada" value={dados.papel} onChange={alterar('papel')} disabled={proprio}>
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
        {novo ? (
          <Campo id="usuario-senha" label="Senha provisória" erro={erros.senha}
            ajuda="Deixe em branco para liberar só o login com Google.">
            <div className="campo-com-botao">
              <input id="usuario-senha" className={`entrada ${erros.senha ? 'invalida' : ''}`} value={dados.senha}
                onChange={alterar('senha')} maxLength={128} autoComplete="off" spellCheck={false} />
              <button type="button" className="btn btn-secundario" onClick={() => setDados((d) => ({ ...d, senha: gerarSenha() }))}>
                Gerar
              </button>
            </div>
          </Campo>
        ) : (
          <label className="caixa-marcar">
            <input type="checkbox" checked={dados.ativo} onChange={alterar('ativo')} disabled={proprio} />
            <span>
              Usuário ativo
              <small>Desativar encerra as sessões abertas na hora.</small>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}

function ModalRedefinir({ usuario, onFechar, onSalvo }) {
  const [senha, setSenha] = useState(gerarSenha);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await apiUsuarios.redefinirSenha(usuario.id, senha);
      onSalvo(`Senha provisória definida para ${usuario.nome}`);
    } catch (err) {
      setErro(err.campos?.senha || mensagemErro(err));
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Senha provisória"
      onFechar={enviando ? undefined : onFechar}
      rodape={(fechar) => (
        <>
          <button className="btn btn-secundario" onClick={fechar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-primario" type="submit" form="form-redefinir" disabled={enviando}>
            {enviando && <span className="spinner" />} Definir senha
          </button>
        </>
      )}
    >
      <p>
        <strong>{usuario.nome}</strong> vai entrar com esta senha e precisará trocá-la. As sessões abertas
        dessa conta serão encerradas. Envie a senha por um canal seguro.
      </p>
      <form id="form-redefinir" onSubmit={salvar} noValidate>
        <Campo id="senha-provisoria" label="Senha provisória" obrigatorio erro={erro}>
          <div className="campo-com-botao">
            <input id="senha-provisoria" className={`entrada mono ${erro ? 'invalida' : ''}`} value={senha}
              onChange={(e) => { setSenha(e.target.value); setErro(null); }} maxLength={128} autoComplete="off" spellCheck={false} />
            <button type="button" className="btn btn-secundario" onClick={() => setSenha(gerarSenha())}>Gerar</button>
          </div>
        </Campo>
      </form>
    </Modal>
  );
}

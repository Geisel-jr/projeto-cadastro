import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { CADASTROS } from './cadastros';
import Icone from './components/Icone';
import MenuUsuario from './components/MenuUsuario';
import ModalSenha from './components/ModalSenha';
import Notificacoes from './components/Notificacoes';
import Auditoria from './paginas/Auditoria';
import FormularioCadastro from './paginas/FormularioCadastro';
import ListaCadastro from './paginas/ListaCadastro';
import Login from './paginas/Login';
import Painel from './paginas/Painel';
import Usuarios from './paginas/Usuarios';
import { aoEncerrarSessao, restaurarSessao, sair } from './sessao';

const MENU = [
  { id: 'painel', label: 'Painel', icone: 'home', rota: { pagina: 'painel' } },
  { id: 'empresas', label: 'Empresas', icone: 'empresa', rota: { pagina: 'lista', entidade: 'empresas' } },
  { id: 'pessoas', label: 'Pessoas', icone: 'pessoa', rota: { pagina: 'lista', entidade: 'pessoas' } },
  { id: 'auditoria', label: 'Auditoria', icone: 'escudo', rota: { pagina: 'auditoria' } },
  { id: 'usuarios', label: 'Usuários', icone: 'usuarios', rota: { pagina: 'usuarios' }, papel: 'admin' },
];

const DURACAO_AVISO = 4500;
const DURACAO_SAIDA = 150; // igual à animação "sair-toast" do CSS

function App() {
  // estado: 'carregando' (verificando a sessão) | 'anonima' (tela de login) | 'ativa'
  const [sessao, setSessao] = useState({ estado: 'carregando', usuario: null });
  // rota = { pagina: 'painel' | 'lista' | 'form' | 'auditoria' | 'usuarios', entidade?, id? }
  const [rota, setRota] = useState({ pagina: 'painel' });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const estadoAtual = useRef(sessao.estado);
  estadoAtual.current = sessao.estado;

  // Marca o aviso como "saindo" (anima) e depois o remove
  const fecharNotificacao = useCallback((id) => {
    setNotificacoes((lista) => lista.map((n) => (n.id === id ? { ...n, saindo: true } : n)));
    setTimeout(() => setNotificacoes((lista) => lista.filter((n) => n.id !== id)), DURACAO_SAIDA);
  }, []);

  const notificar = useCallback((tipo, titulo, mensagem) => {
    const id = Date.now() + Math.random();
    setNotificacoes((lista) => [...lista, { id, tipo, titulo, mensagem }]);
    setTimeout(() => fecharNotificacao(id), DURACAO_AVISO);
  }, [fecharNotificacao]);

  // Ao abrir: tenta recuperar a sessão pelo cookie; se a sessão cair depois, volta ao login
  useEffect(() => {
    restaurarSessao()
      .then((usuario) => setSessao({ estado: 'ativa', usuario }))
      .catch(() => setSessao({ estado: 'anonima', usuario: null }));

    return aoEncerrarSessao((motivo) => {
      if (estadoAtual.current === 'ativa' && motivo === 'expirada') {
        notificar('erro', 'Sua sessão expirou', 'Entre novamente para continuar.');
      }
      setSessao({ estado: 'anonima', usuario: null });
    });
  }, [notificar]);

  const navegar = useCallback((novaRota) => {
    setRota(novaRota);
    window.scrollTo?.(0, 0);
  }, []);

  const aoEntrar = (usuario) => {
    setRota({ pagina: 'painel' });
    setSessao({ estado: 'ativa', usuario });
  };

  const encerrar = async () => {
    try {
      await sair();
    } catch {
      // mesmo sem resposta da API, a sessão local é encerrada
    }
    setTrocandoSenha(false);
    setSessao({ estado: 'anonima', usuario: null });
    notificar('sucesso', 'Você saiu do sistema');
  };

  const aoTrocarSenha = (usuario) => {
    setSessao({ estado: 'ativa', usuario });
    setTrocandoSenha(false);
    notificar('sucesso', 'Senha salva');
  };

  if (sessao.estado === 'carregando') {
    return (
      <div className="tela-inicial" aria-label="Carregando">
        <span className="marca-logo" />
        <span className="spinner" />
      </div>
    );
  }

  if (sessao.estado === 'anonima') {
    return (
      <>
        <Login onEntrar={aoEntrar} />
        <Notificacoes itens={notificacoes} onFechar={fecharNotificacao} />
      </>
    );
  }

  const { usuario } = sessao;
  const senhaProvisoria = usuario.deveTrocarSenha;
  const props = { onNavegar: navegar, notificar };
  const config = CADASTROS[rota.entidade];
  const menuAtivo = rota.entidade || rota.pagina;
  const menu = MENU.filter((item) => !item.papel || item.papel === usuario.papel);

  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="marca" onClick={() => navegar({ pagina: 'painel' })}>
            <span className="marca-logo" aria-hidden="true" />
            <span className="marca-nome">Cadastro<strong>Hub</strong></span>
          </button>

          <nav className="menu">
            {menu.map((item) => (
              <button
                key={item.id}
                className={`menu-item ${menuAtivo === item.id ? 'ativo' : ''}`}
                onClick={() => navegar(item.rota)}
                title={item.label}
                aria-current={menuAtivo === item.id ? 'page' : undefined}
              >
                <Icone nome={item.icone} tamanho={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <MenuUsuario usuario={usuario} onTrocarSenha={() => setTrocandoSenha(true)} onSair={encerrar} />
        </div>
      </header>

      {/* Com senha provisória a API bloqueia os dados; nada é carregado até a troca */}
      {!senhaProvisoria && (
        <main className="container conteudo" id="conteudo" tabIndex={-1}>
          {rota.pagina === 'painel' && <Painel {...props} />}
          {rota.pagina === 'auditoria' && <Auditoria {...props} />}
          {rota.pagina === 'usuarios' && usuario.papel === 'admin' && <Usuarios usuarioAtual={usuario} {...props} />}
          {rota.pagina === 'lista' && <ListaCadastro key={rota.entidade} config={config} {...props} />}
          {rota.pagina === 'form' && (
            <FormularioCadastro key={`${rota.entidade}-${rota.id || 'novo'}`} config={config} id={rota.id} {...props} />
          )}
        </main>
      )}

      {(senhaProvisoria || trocandoSenha) && (
        <ModalSenha
          usuario={usuario}
          obrigatoria={senhaProvisoria}
          onConcluir={aoTrocarSenha}
          onFechar={() => setTrocandoSenha(false)}
          onSair={encerrar}
        />
      )}

      <Notificacoes itens={notificacoes} onFechar={fecharNotificacao} />
    </>
  );
}

export default App;

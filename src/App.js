import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
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
import NaoEncontrada from './paginas/NaoEncontrada';
import Painel from './paginas/Painel';
import Usuarios from './paginas/Usuarios';
import { caminhoDe } from './rotas';
import { aoEncerrarSessao, restaurarSessao, sair } from './sessao';

const MENU = [
  { id: 'painel', label: 'Painel', icone: 'home', caminho: '/' },
  { id: 'empresas', label: 'Empresas', icone: 'empresa', caminho: '/empresas' },
  { id: 'pessoas', label: 'Pessoas', icone: 'pessoa', caminho: '/pessoas' },
  { id: 'auditoria', label: 'Auditoria', icone: 'escudo', caminho: '/auditoria' },
  { id: 'usuarios', label: 'Usuários', icone: 'usuarios', caminho: '/usuarios', papel: 'admin' },
];

const DURACAO_AVISO = 4500;
const DURACAO_SAIDA = 150; // igual à animação "sair-toast" do CSS

// Formulário de um cadastro a partir da URL: /empresas/nova ou /empresas/12
function RotaFormulario({ entidade, ...props }) {
  const { id } = useParams();
  if (id !== undefined && !/^[1-9]\d*$/.test(id)) return <NaoEncontrada />;
  const numero = id && Number(id);
  return (
    <FormularioCadastro key={`${entidade}-${numero || 'novo'}`} config={CADASTROS[entidade]} id={numero} {...props} />
  );
}

function Aplicacao() {
  // estado: 'carregando' (verificando a sessão) | 'anonima' (tela de login) | 'ativa'
  const [sessao, setSessao] = useState({ estado: 'carregando', usuario: null });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const estadoAtual = useRef(sessao.estado);
  estadoAtual.current = sessao.estado;
  const navigate = useNavigate();
  const { pathname } = useLocation();

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

  // Cada página nova começa do topo
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);

  // As páginas pedem navegação com { pagina, entidade, id }; "substituir" não cria
  // uma entrada nova no histórico (ex: de /empresas/nova para /empresas/12 após salvar)
  const navegar = useCallback((rota) => {
    navigate(caminhoDe(rota), { replace: Boolean(rota.substituir) });
  }, [navigate]);

  // Depois do login, continua no endereço que a pessoa tinha aberto
  const aoEntrar = (usuario) => setSessao({ estado: 'ativa', usuario });

  const encerrar = async () => {
    try {
      await sair();
    } catch {
      // mesmo sem resposta da API, a sessão local é encerrada
    }
    setTrocandoSenha(false);
    setSessao({ estado: 'anonima', usuario: null });
    navigate('/');
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
  const admin = usuario.papel === 'admin';
  const props = { onNavegar: navegar, notificar };
  const secao = pathname.split('/')[1] || 'painel';
  const menu = MENU.filter((item) => !item.papel || item.papel === usuario.papel);

  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link className="marca" to="/">
            <span className="marca-logo" aria-hidden="true" />
            <span className="marca-nome">Cadastro<strong>Hub</strong></span>
          </Link>

          <nav className="menu">
            {menu.map((item) => (
              <Link
                key={item.id}
                to={item.caminho}
                className={`menu-item ${secao === item.id ? 'ativo' : ''}`}
                title={item.label}
                aria-current={secao === item.id ? 'page' : undefined}
              >
                <Icone nome={item.icone} tamanho={16} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <MenuUsuario usuario={usuario} onTrocarSenha={() => setTrocandoSenha(true)} onSair={encerrar} />
        </div>
      </header>

      {/* Com senha provisória a API bloqueia os dados; nada é carregado até a troca */}
      {!senhaProvisoria && (
        <main className="container conteudo" id="conteudo" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Painel {...props} />} />
            {Object.keys(CADASTROS).map((entidade) => [
              <Route key={entidade} path={`/${entidade}`}
                element={<ListaCadastro key={entidade} config={CADASTROS[entidade]} {...props} />} />,
              <Route key={`${entidade}-nova`} path={`/${entidade}/nova`}
                element={<RotaFormulario entidade={entidade} {...props} />} />,
              <Route key={`${entidade}-id`} path={`/${entidade}/:id`}
                element={<RotaFormulario entidade={entidade} {...props} />} />,
            ])}
            <Route path="/auditoria" element={<Auditoria {...props} />} />
            <Route path="/usuarios" element={admin ? <Usuarios usuarioAtual={usuario} {...props} /> : <NaoEncontrada />} />
            <Route path="*" element={<NaoEncontrada />} />
          </Routes>
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

export default function App() {
  return (
    <BrowserRouter>
      <Aplicacao />
    </BrowserRouter>
  );
}

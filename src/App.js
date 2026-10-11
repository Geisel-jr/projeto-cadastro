import { useCallback, useState } from 'react';
import './App.css';
import { CADASTROS } from './cadastros';
import Icone from './components/Icone';
import ModalOperador from './components/ModalOperador';
import Notificacoes from './components/Notificacoes';
import { definirOperador, obterOperador } from './operador';
import Auditoria from './paginas/Auditoria';
import FormularioCadastro from './paginas/FormularioCadastro';
import ListaCadastro from './paginas/ListaCadastro';
import Painel from './paginas/Painel';
import { corAvatar, iniciais } from './utils/formatadores';

const MENU = [
  { id: 'painel', label: 'Painel', icone: 'home', rota: { pagina: 'painel' } },
  { id: 'empresas', label: 'Empresas', icone: 'empresa', rota: { pagina: 'lista', entidade: 'empresas' } },
  { id: 'pessoas', label: 'Pessoas', icone: 'pessoa', rota: { pagina: 'lista', entidade: 'pessoas' } },
  { id: 'auditoria', label: 'Auditoria', icone: 'escudo', rota: { pagina: 'auditoria' } },
];

const DURACAO_AVISO = 4500;
const DURACAO_SAIDA = 150; // igual à animação "sair-toast" do CSS

function App() {
  // rota = { pagina: 'painel' | 'lista' | 'form' | 'auditoria', entidade?, id? }
  const [rota, setRota] = useState({ pagina: 'painel' });
  const [operador, setOperador] = useState(obterOperador);
  const [trocandoOperador, setTrocandoOperador] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);

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

  const navegar = useCallback((novaRota) => {
    setRota(novaRota);
    window.scrollTo?.(0, 0);
  }, []);

  const salvarOperador = (nome) => {
    definirOperador(nome);
    setOperador(nome);
    setTrocandoOperador(false);
  };

  const props = { onNavegar: navegar, notificar };
  const config = CADASTROS[rota.entidade];
  const menuAtivo = rota.entidade || rota.pagina;

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
            {MENU.map((item) => (
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

          {operador && (
            <button className="operador" onClick={() => setTrocandoOperador(true)} title="Trocar operador">
              <span className="avatar pequeno colorido" style={corAvatar(operador)}>{iniciais(operador)}</span>
              <span className="operador-nome truncar">{operador}</span>
            </button>
          )}
        </div>
      </header>

      <main className="container conteudo" id="conteudo" tabIndex={-1}>
        {rota.pagina === 'painel' && <Painel {...props} />}
        {rota.pagina === 'auditoria' && <Auditoria {...props} />}
        {rota.pagina === 'lista' && <ListaCadastro key={rota.entidade} config={config} {...props} />}
        {rota.pagina === 'form' && (
          <FormularioCadastro key={`${rota.entidade}-${rota.id || 'novo'}`} config={config} id={rota.id} {...props} />
        )}
      </main>

      {(!operador || trocandoOperador) && (
        <ModalOperador
          atual={operador}
          onSalvar={salvarOperador}
          onFechar={operador ? () => setTrocandoOperador(false) : undefined}
        />
      )}

      <Notificacoes itens={notificacoes} onFechar={fecharNotificacao} />
    </>
  );
}

export default App;

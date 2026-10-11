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
import { iniciais } from './utils/formatadores';

const MENU = [
  { id: 'painel', label: 'Painel', icone: 'home', rota: { pagina: 'painel' } },
  { id: 'empresas', label: 'Empresas', icone: 'empresa', rota: { pagina: 'lista', entidade: 'empresas' } },
  { id: 'pessoas', label: 'Pessoas', icone: 'pessoa', rota: { pagina: 'lista', entidade: 'pessoas' } },
  { id: 'auditoria', label: 'Auditoria', icone: 'escudo', rota: { pagina: 'auditoria' } },
];

function App() {
  // rota = { pagina: 'painel' | 'lista' | 'form' | 'auditoria', entidade?, id? }
  const [rota, setRota] = useState({ pagina: 'painel' });
  const [operador, setOperador] = useState(obterOperador);
  const [trocandoOperador, setTrocandoOperador] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);

  const fecharNotificacao = useCallback((id) => {
    setNotificacoes((lista) => lista.filter((n) => n.id !== id));
  }, []);

  // Mostra um aviso no canto da tela que some sozinho depois de 4s
  const notificar = useCallback((tipo, titulo, mensagem) => {
    const id = Date.now() + Math.random();
    setNotificacoes((lista) => [...lista, { id, tipo, titulo, mensagem }]);
    setTimeout(() => fecharNotificacao(id), 4000);
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
    <div className="app">
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
              >
                <Icone nome={item.icone} tamanho={17} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {operador && (
            <button className="operador" onClick={() => setTrocandoOperador(true)} title="Trocar operador">
              <span className="avatar cinza pequeno">{iniciais(operador)}</span>
              <span className="operador-nome">{operador}</span>
            </button>
          )}
        </div>
      </header>

      <main className="container conteudo">
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
    </div>
  );
}

export default App;

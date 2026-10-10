import { useCallback, useState } from 'react';
import './App.css';
import Icone from './components/Icone';
import Notificacoes from './components/Notificacoes';
import Inicio from './Inicio';
import FormEmpresa from './FormEmpresa';
import FormPessoa from './FormPessoa';
import ListaEmpresas from './ListaEmpresas';
import ListaPessoas from './ListaPessoas';

const MENU = [
  { id: 'inicio', label: 'Início', icone: 'home', telas: ['inicio'] },
  { id: 'lista-empresa', label: 'Empresas', icone: 'empresa', telas: ['lista-empresa', 'form-empresa'] },
  { id: 'lista-pessoa', label: 'Pessoas', icone: 'pessoa', telas: ['lista-pessoa', 'form-pessoa'] },
];

function App() {
  const [tela, setTela] = useState('inicio');
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

  const navegar = (destino) => {
    setTela(destino);
    window.scrollTo(0, 0);
  };

  const props = { onNavegar: navegar, notificar };

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="marca" onClick={() => navegar('inicio')}>
            <span className="marca-logo">C</span>
            <span>Cadastro<strong>Hub</strong></span>
          </button>

          <nav className="menu">
            {MENU.map((item) => (
              <button
                key={item.id}
                className={`menu-item ${item.telas.includes(tela) ? 'ativo' : ''}`}
                onClick={() => navegar(item.id)}
              >
                <Icone nome={item.icone} tamanho={17} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="container conteudo">
        {tela === 'inicio' && <Inicio {...props} />}
        {tela === 'form-empresa' && <FormEmpresa {...props} />}
        {tela === 'form-pessoa' && <FormPessoa {...props} />}
        {tela === 'lista-empresa' && <ListaEmpresas {...props} />}
        {tela === 'lista-pessoa' && <ListaPessoas {...props} />}
      </main>

      <footer className="rodape">
        <div className="container">
          © {new Date().getFullYear()} CadastroHub · Sistema de cadastro de empresas e pessoas
        </div>
      </footer>

      <Notificacoes itens={notificacoes} onFechar={fecharNotificacao} />
    </div>
  );
}

export default App;

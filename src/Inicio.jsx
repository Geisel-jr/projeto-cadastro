import { useEffect, useState } from 'react';
import { listarEmpresas, listarPessoas } from './api';
import Icone from './components/Icone';
import { iniciais } from './utils/formatadores';

export default function Inicio({ onNavegar }) {
  const [empresas, setEmpresas] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    Promise.all([listarEmpresas(), listarPessoas()])
      .then(([e, p]) => {
        setEmpresas(e);
        setPessoas(p);
      })
      .catch(() => setOffline(true))
      .finally(() => setCarregando(false));
  }, []);

  const total = (lista) => (carregando ? '—' : offline ? '?' : lista.length);

  return (
    <>
      <section className="hero">
        <div>
          <span className="hero-tag">Painel de controle</span>
          <h1>Gerencie seus cadastros em um só lugar</h1>
          <p>Cadastre empresas e pessoas de forma rápida, com validação de documentos e busca automática de endereço pelo CEP.</p>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-light btn-lg fw-semibold" onClick={() => onNavegar('form-empresa')}>
              <Icone nome="mais" /> Nova empresa
            </button>
            <button className="btn btn-outline-light btn-lg fw-semibold" onClick={() => onNavegar('form-pessoa')}>
              <Icone nome="mais" /> Nova pessoa
            </button>
          </div>
        </div>
      </section>

      {offline && (
        <div className="aviso aviso-erro">
          <Icone nome="alerta" />
          <span>Não foi possível conectar à API. Verifique se o servidor está rodando em <code>localhost:5000</code>.</span>
        </div>
      )}

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <button className="card-stat" onClick={() => onNavegar('lista-empresa')}>
            <span className="stat-icone azul"><Icone nome="empresa" tamanho={24} /></span>
            <div className="flex-grow-1 text-start">
              <span className="stat-label">Empresas cadastradas</span>
              <span className="stat-valor">{total(empresas)}</span>
            </div>
            <Icone nome="seta" className="stat-seta" />
          </button>
        </div>
        <div className="col-md-6">
          <button className="card-stat" onClick={() => onNavegar('lista-pessoa')}>
            <span className="stat-icone verde"><Icone nome="pessoa" tamanho={24} /></span>
            <div className="flex-grow-1 text-start">
              <span className="stat-label">Pessoas cadastradas</span>
              <span className="stat-valor">{total(pessoas)}</span>
            </div>
            <Icone nome="seta" className="stat-seta" />
          </button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <UltimosCadastros
            titulo="Últimas empresas"
            itens={empresas.slice(0, 5)}
            cor="azul"
            detalhe={(e) => [e.cidade, e.estado].filter(Boolean).join(' / ') || e.email}
            carregando={carregando}
            offline={offline}
            onVerTodos={() => onNavegar('lista-empresa')}
          />
        </div>
        <div className="col-lg-6">
          <UltimosCadastros
            titulo="Últimas pessoas"
            itens={pessoas.slice(0, 5)}
            cor="verde"
            detalhe={(p) => p.profissao || p.email}
            carregando={carregando}
            offline={offline}
            onVerTodos={() => onNavegar('lista-pessoa')}
          />
        </div>
      </div>
    </>
  );
}

function UltimosCadastros({ titulo, itens, cor, detalhe, carregando, offline, onVerTodos }) {
  return (
    <div className="painel h-100">
      <div className="painel-header">
        <h2>{titulo}</h2>
        <button className="btn btn-link btn-sm text-decoration-none" onClick={onVerTodos}>
          Ver todos
        </button>
      </div>
      {carregando ? (
        <div className="p-4 text-center"><div className="spinner-border spinner-border-sm text-primary" /></div>
      ) : itens.length === 0 ? (
        <p className="text-muted text-center py-4 mb-0">{offline ? 'Sem conexão com a API.' : 'Nenhum cadastro ainda.'}</p>
      ) : (
        <ul className="lista-simples">
          {itens.map((item) => (
            <li key={item.id}>
              <span className={`avatar ${cor}`}>{iniciais(item.nome)}</span>
              <div className="min-w-0">
                <strong className="text-truncate d-block">{item.nome}</strong>
                <small className="text-muted">{detalhe(item)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

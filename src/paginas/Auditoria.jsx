import { useEffect, useState } from 'react';
import { api, mensagemErro } from '../api';
import Historico, { EsqueletoHistorico } from '../components/Historico';
import Icone from '../components/Icone';

const LIMITE = 30;

// Todas as ações registradas no sistema: quem fez, o quê, quando e de onde.
export default function Auditoria({ onNavegar }) {
  // Filtros e página ficam juntos: trocar um filtro sempre volta para a página 1
  const [consulta, setConsulta] = useState({ entidade: '', acao: '', usuario: '', pagina: 1 });
  const [usuarioDigitado, setUsuarioDigitado] = useState('');
  const [itens, setItens] = useState([]);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // Espera o usuário parar de digitar antes de filtrar
  useEffect(() => {
    const espera = setTimeout(() => {
      setConsulta((c) => (c.usuario === usuarioDigitado.trim() ? c : { ...c, usuario: usuarioDigitado.trim(), pagina: 1 }));
    }, 350);
    return () => clearTimeout(espera);
  }, [usuarioDigitado]);

  useEffect(() => {
    let cancelado = false; // ignora respostas de consultas antigas
    const ativos = Object.fromEntries(Object.entries(consulta).filter(([, v]) => v));
    setCarregando(true);
    setErro(null);
    api.auditoria({ ...ativos, limite: LIMITE })
      .then((resposta) => {
        if (cancelado) return;
        setItens((anteriores) => (consulta.pagina === 1 ? resposta.itens : [...anteriores, ...resposta.itens]));
        setTemMais(resposta.temMais);
      })
      .catch((e) => !cancelado && setErro(mensagemErro(e)))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
  }, [consulta]);

  const pagina = consulta.pagina;
  const alterarFiltro = (nome) => (e) => setConsulta((c) => ({ ...c, [nome]: e.target.value, pagina: 1 }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Auditoria</h1>
      </div>

      <div className="painel">
        <div className="tabela-toolbar">
          <div className="busca">
            <Icone nome="busca" tamanho={17} />
            <input
              className="entrada"
              placeholder="Operador..."
              aria-label="Filtrar por operador"
              value={usuarioDigitado}
              onChange={(e) => setUsuarioDigitado(e.target.value)}
            />
          </div>
          <select className="entrada filtro" value={consulta.entidade} onChange={alterarFiltro('entidade')}>
            <option value="">Todos os cadastros</option>
            <option value="empresas">Empresas</option>
            <option value="pessoas">Pessoas</option>
          </select>
          <select className="entrada filtro" value={consulta.acao} onChange={alterarFiltro('acao')}>
            <option value="">Todas as ações</option>
            <option value="CRIAR">Criação</option>
            <option value="EDITAR">Edição</option>
            <option value="EXCLUIR">Exclusão</option>
            <option value="RESTAURAR">Restauração</option>
            <option value="ANEXAR">Anexo de documento</option>
            <option value="REMOVER_ANEXO">Remoção de documento</option>
            <option value="RESTAURAR_ANEXO">Restauração de documento</option>
          </select>
        </div>

        <div className="painel-corpo">
          {erro ? (
            <div className="estado">
              <span className="estado-icone erro"><Icone nome="alerta" tamanho={24} /></span>
              <p>{erro}</p>
            </div>
          ) : (
            <>
              {!(carregando && pagina === 1) && (
                <Historico
                  itens={itens}
                  mostrarRegistro
                  onAbrir={(entidade, id) => onNavegar({ pagina: 'form', entidade, id })}
                />
              )}
              {carregando && (pagina === 1 ? <EsqueletoHistorico linhas={5} /> : <div className="carregando"><span className="spinner" /></div>)}
              {temMais && !carregando && (
                <div className="carregar-mais">
                  <button className="btn btn-secundario btn-pequeno" onClick={() => setConsulta((c) => ({ ...c, pagina: c.pagina + 1 }))}>
                    Carregar mais
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

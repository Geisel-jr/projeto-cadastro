import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, mensagemErro } from '../api';
import { useTituloPagina } from '../rotas';
import Icone from '../components/Icone';
import ModalExclusao from '../components/ModalExclusao';
import { formatarDataHora } from '../utils/formatadores';

// Listagem de um cadastro, com busca, filtro Ativos/Excluídos e ações por linha.
export default function ListaCadastro({ config, onNavegar, notificar }) {
  useTituloPagina(config.plural);
  // Filtro e busca ficam na URL (?status=excluidos&q=texto): voltar e compartilhar o link preservam a tela
  const [parametros, setParametros] = useSearchParams();
  const status = parametros.get('status') === 'excluidos' ? 'excluidos' : 'ativos';
  const filtro = parametros.get('q') || '';
  const alterarParametro = (nome, valor, substituir) => {
    setParametros((atuais) => {
      const novos = new URLSearchParams(atuais);
      if (valor) novos.set(nome, valor);
      else novos.delete(nome);
      return novos;
    }, { replace: substituir });
  };
  const setStatus = (valor) => alterarParametro('status', valor === 'excluidos' ? valor : null, false);
  // Digitar na busca não enche o histórico do navegador
  const setFiltro = (valor) => alterarParametro('q', valor, true);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const campoBusca = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await api.listar(config.entidade, status));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [config.entidade, status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // "/" leva o cursor para a busca
  useEffect(() => {
    const aoTeclar = (e) => {
      const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !digitando) {
        e.preventDefault();
        campoBusca.current?.focus();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return itens;
    const termoDigitos = termo.replace(/\D/g, '');
    return itens.filter((item) =>
      config.busca.some((campo) => {
        const valor = String(item[campo] ?? '').toLowerCase();
        return valor.includes(termo) || (termoDigitos && valor.replace(/\D/g, '').includes(termoDigitos));
      })
    );
  }, [itens, filtro, config.busca]);

  const abrir = (item) => onNavegar({ pagina: 'form', entidade: config.entidade, id: item.id });

  const excluir = async (motivo) => {
    await api.excluir(config.entidade, excluindo.id, motivo);
    notificar('sucesso', 'Registro excluído', config.nomeExibicao(excluindo));
    setExcluindo(null);
    carregar();
  };

  const restaurar = async (item) => {
    try {
      await api.restaurar(config.entidade, item.id);
      notificar('sucesso', 'Registro restaurado', config.nomeExibicao(item));
      carregar();
    } catch (e) {
      notificar('erro', 'Não foi possível restaurar', mensagemErro(e));
    }
  };

  const verExcluidos = status === 'excluidos';

  // Nos excluídos, quem excluiu e o motivo aparecem logo depois do nome
  const colunaExclusao = {
    titulo: 'Exclusão',
    render: (item) => (
      <div className="celula-dupla celula-motivo">
        <span>{item.excluidoPor} · {formatarDataHora(item.excluidoEm)}</span>
        <small title={item.motivoExclusao}>{item.motivoExclusao}</small>
      </div>
    ),
  };
  const colunas = verExcluidos
    ? [config.colunas[0], colunaExclusao, ...config.colunas.slice(1)]
    : config.colunas;

  let conteudo;
  if (carregando) {
    conteudo = (
      <div className="esqueleto" aria-label="Carregando">
        {[62, 48, 70, 55, 40].map((largura, i) => (
          <div className="esqueleto-linha" key={i}>
            <span className="esq circulo" />
            <span className="esq" style={{ width: `${largura}%` }} />
          </div>
        ))}
      </div>
    );
  } else if (erro) {
    conteudo = (
      <div className="estado">
        <span className="estado-icone erro"><Icone nome="alerta" tamanho={24} /></span>
        <p>{erro}</p>
        <button className="btn btn-secundario btn-pequeno" onClick={carregar}>Tentar novamente</button>
      </div>
    );
  } else if (filtrados.length === 0) {
    conteudo = (
      <div className="estado">
        <span className="estado-icone"><Icone nome="vazio" tamanho={24} /></span>
        <p>{itens.length > 0 ? 'Nenhum resultado.' : verExcluidos ? 'Nenhum registro excluído.' : 'Nenhum cadastro ainda.'}</p>
      </div>
    );
  } else {
    conteudo = (
      <div className="rolagem-x">
        <table className="tabela">
          <thead>
            <tr>
              {colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}
              <th className="coluna-acoes"><span className="visualmente-oculto">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item) => (
              <tr key={item.id} onClick={() => abrir(item)} className="linha-clicavel">
                {colunas.map((c) => <td key={c.titulo}>{c.render(item)}</td>)}
                <td className="coluna-acoes" onClick={(e) => e.stopPropagation()}>
                  <div className="acoes">
                    {verExcluidos ? (
                      <button className="btn-acao" onClick={() => restaurar(item)} title="Restaurar" aria-label="Restaurar">
                        <Icone nome="restaurar" tamanho={17} />
                      </button>
                    ) : (
                      <>
                        <button className="btn-acao" onClick={() => abrir(item)} title="Editar" aria-label="Editar">
                          <Icone nome="editar" tamanho={17} />
                        </button>
                        <button className="btn-acao perigo" onClick={() => setExcluindo(item)} title="Excluir" aria-label="Excluir">
                          <Icone nome="lixeira" tamanho={17} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{config.plural}</h1>
        <button className="btn btn-primario" onClick={() => onNavegar({ pagina: 'form', entidade: config.entidade })}>
          <Icone nome="mais" tamanho={16} /> {config.novo}
        </button>
      </div>

      <div className="painel">
        <div className="tabela-toolbar">
          <div className="busca">
            <Icone nome="busca" tamanho={16} />
            <input
              ref={campoBusca}
              className="entrada"
              placeholder="Buscar..."
              aria-label="Buscar"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <kbd className="atalho">/</kbd>
          </div>

          <div className="segmentado" role="group" aria-label="Situação" data-ativo={verExcluidos ? 1 : 0}>
            <button className={!verExcluidos ? 'ativo' : ''} aria-pressed={!verExcluidos} onClick={() => setStatus('ativos')}>Ativos</button>
            <button className={verExcluidos ? 'ativo' : ''} aria-pressed={verExcluidos} onClick={() => setStatus('excluidos')}>Excluídos</button>
          </div>

          <div className="toolbar-fim">
            {!carregando && !erro && <span>{filtrados.length} de {itens.length}</span>}
            <button className="btn-icone" onClick={carregar} title="Atualizar" aria-label="Atualizar">
              <Icone nome="atualizar" tamanho={16} />
            </button>
          </div>
        </div>
        {conteudo}
      </div>

      {excluindo && (
        <ModalExclusao
          descricao={<>Excluir <strong>{config.nomeExibicao(excluindo)}</strong>?</>}
          onConfirmar={excluir}
          onFechar={() => setExcluindo(null)}
        />
      )}
    </>
  );
}

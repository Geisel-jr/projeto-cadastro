import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, mensagemErro } from '../api';
import { useTituloPagina } from '../rotas';
import Icone from '../components/Icone';
import ModalExclusao from '../components/ModalExclusao';
import Paginacao from '../components/Paginacao';
import { formatarDataHora } from '../utils/formatadores';

const POR_PAGINA = 20;

// Listagem de um cadastro. Busca, ordenação e paginação são feitas no servidor;
// tudo fica na URL (?status=excluidos&q=texto&pagina=2&ordem=nome&direcao=desc),
// então voltar, recarregar e compartilhar o link preservam a tela.
export default function ListaCadastro({ config, onNavegar, notificar }) {
  useTituloPagina(config.plural);
  const [parametros, setParametros] = useSearchParams();
  const status = parametros.get('status') === 'excluidos' ? 'excluidos' : 'ativos';
  const termo = parametros.get('q') || '';
  const pagina = Math.max(Number(parametros.get('pagina')) || 1, 1);
  const ordem = parametros.get('ordem') || '';
  const direcao = parametros.get('direcao') === 'desc' ? 'desc' : 'asc';

  const [busca, setBusca] = useState(termo); // o que está digitado (a URL é atualizada com uma pequena espera)
  const [resultado, setResultado] = useState(null); // { itens, total, pagina, paginas }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const campoBusca = useRef(null);

  // Altera parâmetros da URL; qualquer mudança que não seja de página volta para a página 1
  const alterar = useCallback((novos, { substituir = false } = {}) => {
    setParametros((atuais) => {
      const proximos = new URLSearchParams(atuais);
      if (!('pagina' in novos)) proximos.delete('pagina');
      for (const [nome, valor] of Object.entries(novos)) {
        if (valor && !(nome === 'pagina' && valor === 1)) proximos.set(nome, valor);
        else proximos.delete(nome);
      }
      return proximos;
    }, { replace: substituir });
  }, [setParametros]);

  // Espera 300 ms sem digitar antes de buscar (e não enche o histórico do navegador)
  useEffect(() => {
    if (busca.trim() === termo) return undefined;
    const espera = setTimeout(() => alterar({ q: busca.trim() }, { substituir: true }), 300);
    return () => clearTimeout(espera);
  }, [busca, termo, alterar]);

  // Mantém o campo em dia quando a URL muda por fora (voltar do navegador, link)
  useEffect(() => {
    setBusca((atual) => (atual.trim() === termo ? atual : termo));
  }, [termo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setResultado(await api.listar(config.entidade, {
        status, q: termo, pagina, limite: POR_PAGINA, ordem, direcao,
      }));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [config.entidade, status, termo, pagina, ordem, direcao]);

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

  // Clique no cabeçalho: ordena pela coluna; clicar de novo inverte; a terceira vez volta ao padrão
  const ordenarPor = (chave) => {
    if (ordem !== chave) alterar({ ordem: chave, direcao: null });
    else if (direcao === 'asc') alterar({ ordem: chave, direcao: 'desc' });
    else alterar({ ordem: null, direcao: null });
  };

  const verExcluidos = status === 'excluidos';

  // Nos excluídos, quem excluiu e o motivo aparecem logo depois do nome
  const colunaExclusao = {
    titulo: 'Exclusão',
    ordem: 'excluido',
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

  const itens = resultado?.itens || [];
  const recarregando = carregando && resultado; // já há uma página na tela: esmaece em vez de piscar

  let conteudo;
  if (carregando && !resultado) {
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
  } else if (itens.length === 0) {
    conteudo = (
      <div className="estado">
        <span className="estado-icone"><Icone nome="vazio" tamanho={24} /></span>
        <p>{termo ? `Nada encontrado para "${termo}".` : verExcluidos ? 'Nenhum registro excluído.' : 'Nenhum cadastro ainda.'}</p>
        {termo && <button className="btn btn-secundario btn-pequeno" onClick={() => setBusca('')}>Limpar busca</button>}
      </div>
    );
  } else {
    conteudo = (
      <>
        <div className={`rolagem-x ${recarregando ? 'recarregando' : ''}`} aria-busy={Boolean(recarregando)}>
          <table className="tabela">
            <thead>
              <tr>
                {colunas.map((c) => {
                  const ativa = c.ordem && ordem === c.ordem;
                  return (
                    <th key={c.titulo} aria-sort={ativa ? (direcao === 'asc' ? 'ascending' : 'descending') : undefined}>
                      {c.ordem ? (
                        <button className={`ordenar ${ativa ? 'ativa' : ''}`} onClick={() => ordenarPor(c.ordem)}>
                          {c.titulo}
                          <Icone nome="seta-baixo" tamanho={13} className={ativa && direcao === 'asc' ? 'para-cima' : ''} />
                        </button>
                      ) : c.titulo}
                    </th>
                  );
                })}
                <th className="coluna-acoes"><span className="visualmente-oculto">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
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
        <Paginacao
          pagina={resultado.pagina}
          paginas={resultado.paginas}
          total={resultado.total}
          porPagina={POR_PAGINA}
          onMudar={(p) => alterar({ pagina: p })}
        />
      </>
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
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              maxLength={100}
            />
            <kbd className="atalho">/</kbd>
          </div>

          <div className="segmentado" role="group" aria-label="Situação" data-ativo={verExcluidos ? 1 : 0}>
            <button className={!verExcluidos ? 'ativo' : ''} aria-pressed={!verExcluidos} onClick={() => alterar({ status: null })}>Ativos</button>
            <button className={verExcluidos ? 'ativo' : ''} aria-pressed={verExcluidos} onClick={() => alterar({ status: 'excluidos' })}>Excluídos</button>
          </div>

          <div className="toolbar-fim">
            {recarregando && <span className="spinner" aria-label="Atualizando" />}
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

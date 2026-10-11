import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, mensagemErro } from '../api';
import Icone from '../components/Icone';
import ModalExclusao from '../components/ModalExclusao';
import { formatarDataHora } from '../utils/formatadores';

// Listagem de um cadastro, com busca, filtro Ativos/Excluídos e ações por linha.
export default function ListaCadastro({ config, statusInicial = 'ativos', onNavegar, notificar }) {
  const [status, setStatus] = useState(statusInicial);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [excluindo, setExcluindo] = useState(null);
  const campoBusca = useRef(null);

  // "/" leva o cursor para a busca (atalho comum em sistemas web)
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
    notificar('sucesso', 'Registro excluído', `${config.nomeExibicao(excluindo)} foi movido para Excluídos.`);
    setExcluindo(null);
    carregar();
  };

  const restaurar = async (item) => {
    try {
      await api.restaurar(config.entidade, item.id);
      notificar('sucesso', 'Registro restaurado', `${config.nomeExibicao(item)} voltou para os ativos.`);
      carregar();
    } catch (e) {
      notificar('erro', 'Não foi possível restaurar', mensagemErro(e));
    }
  };

  const verExcluidos = status === 'excluidos';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{config.plural}</h1>
        <button className="btn btn-primary" onClick={() => onNavegar({ pagina: 'form', entidade: config.entidade })}>
          <Icone nome="mais" /> {config.novo}
        </button>
      </div>

      <div className="painel">
        <div className="tabela-toolbar">
          <div className="busca">
            <Icone nome="busca" tamanho={17} />
            <input
              ref={campoBusca}
              className="form-control"
              placeholder="Buscar por nome, documento, e-mail..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <kbd className="atalho">/</kbd>
          </div>

          <div className="segmentado" role="group" aria-label="Filtrar por situação">
            <button className={!verExcluidos ? 'ativo' : ''} onClick={() => setStatus('ativos')}>Ativos</button>
            <button className={verExcluidos ? 'ativo' : ''} onClick={() => setStatus('excluidos')}>Excluídos</button>
          </div>

          <span className="texto-suave small ms-auto">
            {!carregando && !erro && `${filtrados.length} de ${itens.length}`}
          </span>
          <button className="btn-icone" onClick={carregar} title="Atualizar" aria-label="Atualizar">
            <Icone nome="atualizar" tamanho={17} />
          </button>
        </div>

        {carregando ? (
          <div className="esqueleto" aria-label="Carregando">
            {[62, 48, 70, 55, 40].map((largura, i) => (
              <div className="esqueleto-linha" key={i}>
                <span className="esq circulo" />
                <span className="esq texto" style={{ width: `${largura}%` }} />
              </div>
            ))}
          </div>
        ) : erro ? (
          <div className="estado">
            <span className="estado-icone erro"><Icone nome="alerta" tamanho={28} /></span>
            <p>{erro}</p>
            <button className="btn btn-outline-primary btn-sm" onClick={carregar}>Tentar novamente</button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="estado">
            <span className="estado-icone"><Icone nome="vazio" tamanho={28} /></span>
            <p>
              {itens.length > 0 ? 'Nenhum resultado para a busca.'
                : verExcluidos ? 'Nenhum registro excluído.' : `Nenhum${config.singular === 'empresa' ? 'a empresa cadastrada' : 'a pessoa cadastrada'}.`}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table tabela mb-0">
              <thead>
                <tr>
                  {config.colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}
                  {verExcluidos && <th>Exclusão</th>}
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id} onClick={() => abrir(item)} className="linha-clicavel">
                    {config.colunas.map((c) => <td key={c.titulo}>{c.render(item)}</td>)}
                    {verExcluidos && (
                      <td>
                        <div className="celula-dupla">
                          <span>{item.excluidoPor} · {formatarDataHora(item.excluidoEm)}</span>
                          <small className="text-truncate d-block" style={{ maxWidth: 220 }} title={item.motivoExclusao}>
                            {item.motivoExclusao}
                          </small>
                        </div>
                      </td>
                    )}
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="acoes">
                        {verExcluidos ? (
                          <button className="btn-acao" onClick={() => restaurar(item)} title="Restaurar">
                            <Icone nome="restaurar" tamanho={17} />
                          </button>
                        ) : (
                          <>
                            <button className="btn-acao" onClick={() => abrir(item)} title="Editar">
                              <Icone nome="editar" tamanho={17} />
                            </button>
                            <button className="btn-acao perigo" onClick={() => setExcluindo(item)} title="Excluir">
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
        )}
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

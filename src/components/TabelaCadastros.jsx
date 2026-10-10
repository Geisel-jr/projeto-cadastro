import { useCallback, useEffect, useMemo, useState } from 'react';
import Icone from './Icone';

// Tabela reutilizável usada nas listas de empresas e pessoas.
// "colunas" é uma lista de { titulo, render(item) }.
export default function TabelaCadastros({ buscar, colunas, camposBusca, textoVazio, onNovo, textoNovo }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await buscar());
    } catch (e) {
      console.error(e);
      setErro('Não foi possível carregar os dados. Verifique se a API está rodando.');
    } finally {
      setCarregando(false);
    }
  }, [buscar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return itens;
    const termoDigitos = termo.replace(/\D/g, '');
    return itens.filter((item) =>
      camposBusca.some((campo) => {
        const valor = String(item[campo] ?? '').toLowerCase();
        return valor.includes(termo) || (termoDigitos && valor.replace(/\D/g, '').includes(termoDigitos));
      })
    );
  }, [itens, filtro, camposBusca]);

  return (
    <div className="painel">
      <div className="tabela-toolbar">
        <div className="busca">
          <Icone nome="busca" tamanho={17} />
          <input
            className="form-control"
            placeholder="Buscar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <div className="d-flex align-items-center gap-3">
          {!carregando && !erro && (
            <span className="text-muted small">
              {filtrados.length} de {itens.length} registro(s)
            </span>
          )}
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={carregar}>
            <Icone nome="atualizar" tamanho={15} /> Atualizar
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="estado">
          <div className="spinner-border text-primary" />
          <p>Carregando...</p>
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
          <p>{itens.length === 0 ? textoVazio : 'Nenhum resultado para a busca.'}</p>
          {itens.length === 0 && (
            <button className="btn btn-primary btn-sm" onClick={onNovo}>{textoNovo}</button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table tabela mb-0">
            <thead>
              <tr>
                {colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => (
                <tr key={item.id}>
                  {colunas.map((c) => <td key={c.titulo}>{c.render(item)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

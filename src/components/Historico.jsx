import { CADASTROS } from '../cadastros';
import { camposDe, formatarValor } from '../cadastros/campos';
import { corAvatar, formatarDataHora, iniciais } from '../utils/formatadores';

const ACOES = {
  CRIAR: { verbo: 'cadastrou', rotulo: 'Criação', classe: 'criar' },
  EDITAR: { verbo: 'editou', rotulo: 'Edição', classe: 'editar' },
  EXCLUIR: { verbo: 'excluiu', rotulo: 'Exclusão', classe: 'excluir' },
  RESTAURAR: { verbo: 'restaurou', rotulo: 'Restauração', classe: 'restaurar' },
  ANEXAR: { verbo: 'anexou um documento', rotulo: 'Anexo', classe: 'criar', anexo: true },
  REMOVER_ANEXO: { verbo: 'removeu um documento', rotulo: 'Remoção de anexo', classe: 'excluir', anexo: true },
  RESTAURAR_ANEXO: { verbo: 'restaurou um documento', rotulo: 'Restauração de anexo', classe: 'restaurar', anexo: true },
};

// Nas ações com anexos, os dados gravados são do documento (não da empresa)
const descreverDocumento = (doc) => `${doc.tipo === 'Outros' ? doc.descricao : doc.tipo} · ${doc.nomeArquivo}`;

// Campos que mudaram entre a versão anterior e a nova do registro
function alteracoes(config, antes, depois) {
  return camposDe(config)
    .filter((campo) => !campo.somenteFormulario)
    .filter((campo) => String(antes?.[campo.nome] ?? '') !== String(depois?.[campo.nome] ?? ''))
    .map((campo) => ({
      label: campo.label,
      de: formatarValor(campo, antes?.[campo.nome], antes),
      para: formatarValor(campo, depois?.[campo.nome], depois),
    }));
}

// Linha do tempo de ações da auditoria.
// "mostrarRegistro" exibe sobre qual registro foi a ação (usado nas telas gerais).
export default function Historico({ itens, mostrarRegistro = false, onAbrir }) {
  if (itens.length === 0) return <p className="vazio">Nenhuma ação registrada.</p>;

  return (
    <ul className="historico">
      {itens.map((item, indice) => {
        const config = CADASTROS[item.entidade];
        const acao = ACOES[item.acao];
        const dados = item.dadosNovos || item.dadosAnteriores;
        const nomeRegistro = acao.anexo ? dados?.empresaNome : config?.nomeExibicao(dados);
        const mudancas = item.acao === 'EDITAR' && config ? alteracoes(config, item.dadosAnteriores, item.dadosNovos) : [];

        return (
          // Entrada em cascata; o atraso para de crescer no 9º item para listas longas não demorarem
          <li key={item.id} style={{ '--i': Math.min(indice, 8) }}>
            <span className="avatar colorido" style={corAvatar(item.usuario)} title={item.usuario}>{iniciais(item.usuario)}</span>
            <div className="historico-conteudo">
              <div className="historico-linha">
                <span>
                  <strong>{item.usuario}</strong> {acao.verbo}
                  {mostrarRegistro && config && (
                    <>
                      {' '}{acao.anexo ? 'da' : 'a'} {config.singular}{' '}
                      <button className="link-registro" onClick={() => onAbrir?.(item.entidade, item.registroId)}>
                        {nomeRegistro}
                      </button>
                    </>
                  )}
                </span>
                <span className={`badge-acao ${acao.classe}`}>{acao.rotulo}</span>
              </div>
              <span className="historico-data">
                {formatarDataHora(item.data)}{item.ip ? ` · IP ${item.ip}` : ''}
              </span>

              {acao.anexo && dados && <div className="historico-detalhe">{descreverDocumento(dados)}</div>}
              {item.motivo && (
                <div className="historico-detalhe" title={item.motivo}>
                  <span className="limite-linhas">Motivo: {item.motivo}</span>
                </div>
              )}
              {mudancas.length > 0 && (
                <ul className="historico-detalhe mudancas">
                  {mudancas.map((m) => (
                    <li key={m.label}>
                      <span className="texto-suave">{m.label}:</span> <del>{m.de}</del> → {m.para}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Esqueleto no formato da linha do tempo, exibido enquanto ela carrega
export function EsqueletoHistorico({ linhas = 4 }) {
  return (
    <ul className="historico" aria-label="Carregando" aria-busy="true">
      {[58, 44, 66, 50, 38].slice(0, linhas).map((largura, i) => (
        <li key={i} className="esqueleto-item">
          <span className="esq circulo" />
          <div className="historico-conteudo">
            <span className="esq" style={{ width: `${largura}%` }} />
            <span className="esq curto" style={{ width: '22%' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

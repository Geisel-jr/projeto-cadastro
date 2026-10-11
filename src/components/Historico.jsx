import { CADASTROS } from '../cadastros';
import { camposDe, formatarValor } from '../cadastros/campos';
import { formatarDataHora, iniciais } from '../utils/formatadores';

export const ACOES = {
  CRIAR: { verbo: 'cadastrou', rotulo: 'Criação', classe: 'criar' },
  EDITAR: { verbo: 'editou', rotulo: 'Edição', classe: 'editar' },
  EXCLUIR: { verbo: 'excluiu', rotulo: 'Exclusão', classe: 'excluir' },
  RESTAURAR: { verbo: 'restaurou', rotulo: 'Restauração', classe: 'restaurar' },
  ANEXAR: { verbo: 'anexou um documento', rotulo: 'Anexo', classe: 'criar', anexo: true },
  REMOVER_ANEXO: { verbo: 'removeu um documento', rotulo: 'Remoção de anexo', classe: 'excluir', anexo: true },
  RESTAURAR_ANEXO: { verbo: 'restaurou um documento', rotulo: 'Restauração de anexo', classe: 'restaurar', anexo: true },
};

// Nas ações com anexos, os dados gravados são do documento (não da empresa)
const descreverDocumento = (doc) =>
  `${doc.tipo === 'Outros' ? doc.descricao : doc.tipo} · ${doc.nomeArquivo}`;

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
  if (itens.length === 0) {
    return <p className="texto-suave text-center py-4 mb-0">Nenhuma ação registrada.</p>;
  }

  return (
    <ul className="historico">
      {itens.map((item) => {
        const config = CADASTROS[item.entidade];
        const acao = ACOES[item.acao];
        const dados = item.dadosNovos || item.dadosAnteriores;
        const nomeRegistro = acao.anexo ? dados?.empresaNome : config?.nomeExibicao(dados);
        const mudancas = item.acao === 'EDITAR' && config
          ? alteracoes(config, item.dadosAnteriores, item.dadosNovos)
          : [];

        return (
          <li key={item.id}>
            <span className="avatar cinza" title={item.usuario}>{iniciais(item.usuario)}</span>
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
              <small className="texto-suave">
                {formatarDataHora(item.data)}{item.ip ? ` · IP ${item.ip}` : ''}
              </small>

              {acao.anexo && dados && <div className="historico-detalhe">{descreverDocumento(dados)}</div>}
              {item.motivo && <div className="historico-detalhe">Motivo: {item.motivo}</div>}

              {mudancas.length > 0 && (
                <ul className="historico-detalhe mudancas">
                  {mudancas.map((m) => (
                    <li key={m.label}>
                      <span className="texto-suave">{m.label}:</span> <del>{m.de}</del> → <span>{m.para}</span>
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

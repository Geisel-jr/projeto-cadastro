import { useCallback, useEffect, useRef, useState } from 'react';
import { documentos as apiDocumentos, mensagemErro } from '../api';
import { diasAte, formatarData, formatarTamanho } from '../utils/formatadores';
import Campo from './Campo';
import Icone from './Icone';
import ModalExclusao from './ModalExclusao';

const TIPO_PADRAO = 'Cartão CNPJ';

const ROTULO_ARQUIVO = { pdf: 'PDF', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', webp: 'IMG', docx: 'DOC', xlsx: 'XLS' };
const extensaoDe = (nome) => nome.split('.').pop().toLowerCase();
const nomeDocumento = (doc) => (doc.tipo === 'Outros' ? doc.descricao : doc.tipo);

function Validade({ data }) {
  const dias = diasAte(data);
  if (dias === null) return null;
  if (dias < 0) return <span className="selo perigo">Vencido em {formatarData(data)}</span>;
  if (dias <= 30) return <span className="selo alerta">Vence {dias === 0 ? 'hoje' : `em ${dias} dia(s)`}</span>;
  return <span className="selo">Válido até {formatarData(data)}</span>;
}

// Painel lateral com os documentos da empresa (arquivos guardados no MinIO).
export default function PainelDocumentos({ empresaId, bloqueado, notificar, onAlterar }) {
  const [opcoes, setOpcoes] = useState(null); // tipos, extensões e tamanho máximo aceitos
  const [lista, setLista] = useState(null);
  const [removidos, setRemovidos] = useState(null); // null = seção fechada
  const [envio, setEnvio] = useState(null); // { tipo, arquivo } com o formulário aberto
  const [removendo, setRemovendo] = useState(null);
  const [arrastando, setArrastando] = useState(false);

  const carregar = useCallback(async (incluirRemovidos) => {
    try {
      setLista(await apiDocumentos.listar(empresaId));
      if (incluirRemovidos) setRemovidos(await apiDocumentos.listar(empresaId, 'excluidos'));
    } catch (e) {
      setLista([]);
      notificar('erro', 'Erro ao carregar documentos', mensagemErro(e));
    }
  }, [empresaId, notificar]);

  useEffect(() => {
    apiDocumentos.tipos().then(setOpcoes).catch(() => {});
  }, []);

  useEffect(() => {
    if (empresaId) carregar(false);
  }, [empresaId, carregar]);

  const aposAlterar = async () => {
    await carregar(Boolean(removidos));
    onAlterar?.();
  };

  const alternarRemovidos = async () => {
    if (removidos) return setRemovidos(null);
    try {
      setRemovidos(await apiDocumentos.listar(empresaId, 'excluidos'));
    } catch (e) {
      notificar('erro', 'Erro ao carregar removidos', mensagemErro(e));
    }
  };

  const restaurar = async (doc) => {
    try {
      await apiDocumentos.restaurar(empresaId, doc.id);
      notificar('sucesso', 'Documento restaurado', nomeDocumento(doc));
      await aposAlterar();
    } catch (e) {
      notificar('erro', 'Não foi possível restaurar', mensagemErro(e));
    }
  };

  const remover = async (motivo) => {
    await apiDocumentos.remover(empresaId, removendo.id, motivo);
    notificar('sucesso', 'Documento removido', nomeDocumento(removendo));
    setRemovendo(null);
    await aposAlterar();
  };

  // Soltar um arquivo em qualquer parte do painel abre o formulário de envio
  const podeEnviar = empresaId && !bloqueado;
  const eventosArrastar = podeEnviar ? {
    onDragOver: (e) => { e.preventDefault(); setArrastando(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setArrastando(false); },
    onDrop: (e) => {
      e.preventDefault();
      setArrastando(false);
      const arquivo = e.dataTransfer.files[0];
      if (arquivo) setEnvio((atual) => ({ tipo: atual?.tipo || TIPO_PADRAO, arquivo }));
    },
  } : {};

  const faltaCartao = lista && !lista.some((d) => d.tipo === TIPO_PADRAO);

  return (
    <section className={`painel documentos ${arrastando ? 'arrastando' : ''}`} {...eventosArrastar}>
      <div className="painel-header">
        <h2>
          Documentos
          {lista?.length > 0 && <span className="contador">{lista.length}</span>}
        </h2>
        {podeEnviar && !envio && (
          <button className="btn btn-secundario btn-pequeno" onClick={() => setEnvio({ tipo: TIPO_PADRAO })}>
            <Icone nome="anexo" tamanho={15} /> Anexar
          </button>
        )}
      </div>

      {!empresaId ? (
        <p className="vazio">Disponível após salvar.</p>
      ) : (
        <>
          {envio && opcoes && (
            <FormularioEnvio
              empresaId={empresaId}
              opcoes={opcoes}
              inicial={envio}
              notificar={notificar}
              onCancelar={() => setEnvio(null)}
              onEnviado={async (doc) => {
                setEnvio(null);
                notificar('sucesso', 'Documento anexado', nomeDocumento(doc));
                await aposAlterar();
              }}
            />
          )}

          {faltaCartao && !envio && podeEnviar && (
            <button className="documento-pendente" onClick={() => setEnvio({ tipo: TIPO_PADRAO })}>
              <span className="doc-icone pendente"><Icone nome="upload" tamanho={16} /></span>
              <span>
                <strong>Cartão CNPJ</strong>
                <small>Pendente</small>
              </span>
            </button>
          )}

          {lista === null ? (
            <div className="painel-corpo"><span className="esq" /><span className="esq curto" /></div>
          ) : lista.length === 0 && !faltaCartao ? (
            <p className="vazio">Nenhum documento.</p>
          ) : (
            <ul>
              {lista.map((doc) => (
                <ItemDocumento
                  key={doc.id}
                  doc={doc}
                  empresaId={empresaId}
                  acao={!bloqueado && (
                    <button className="btn-acao perigo" onClick={() => setRemovendo(doc)} title="Remover" aria-label="Remover">
                      <Icone nome="lixeira" tamanho={16} />
                    </button>
                  )}
                />
              ))}
            </ul>
          )}

          {removidos && (
            removidos.length === 0 ? (
              <p className="vazio">Nenhum documento removido.</p>
            ) : (
              <ul className="removidos">
                {removidos.map((doc) => (
                  <ItemDocumento
                    key={doc.id}
                    doc={doc}
                    empresaId={empresaId}
                    acao={!bloqueado && (
                      <button className="btn-acao" onClick={() => restaurar(doc)} title="Restaurar" aria-label="Restaurar">
                        <Icone nome="restaurar" tamanho={16} />
                      </button>
                    )}
                  />
                ))}
              </ul>
            )
          )}
          <button className="link-removidos" onClick={alternarRemovidos}>
            {removidos ? 'Ocultar removidos' : 'Ver removidos'}
          </button>
        </>
      )}

      {removendo && (
        <ModalExclusao
          titulo="Remover documento"
          descricao={<>Remover <strong>{nomeDocumento(removendo)}</strong>?</>}
          botao="Remover"
          onConfirmar={remover}
          onFechar={() => setRemovendo(null)}
        />
      )}
    </section>
  );
}

function ItemDocumento({ doc, empresaId, acao }) {
  const ext = extensaoDe(doc.nomeArquivo);
  return (
    <li className="documento">
      <span className={`doc-icone ${ext}`}>{ROTULO_ARQUIVO[ext] || 'ARQ'}</span>
      <div className="doc-info">
        <strong>{nomeDocumento(doc)}</strong>
        {doc.tipo !== 'Outros' && doc.descricao && <span className="doc-descricao truncar" title={doc.descricao}>{doc.descricao}</span>}
        <small className="truncar" title={doc.nomeArquivo}>{doc.nomeArquivo} · {formatarTamanho(doc.tamanho)}</small>
        {doc.excluidoEm ? (
          <small className="limite-linhas" title={doc.motivoExclusao}>
            Removido por {doc.excluidoPor}: {doc.motivoExclusao}
          </small>
        ) : (
          <small className="truncar">{doc.criadoPor} · {new Date(doc.criadoEm).toLocaleDateString('pt-BR')}</small>
        )}
        {!doc.excluidoEm && doc.validade && <Validade data={doc.validade} />}
      </div>
      <div className="doc-acoes">
        <a className="btn-acao" href={apiDocumentos.url(empresaId, doc.id)} target="_blank" rel="noopener noreferrer" title="Visualizar" aria-label="Visualizar">
          <Icone nome="olho" tamanho={16} />
        </a>
        <a className="btn-acao" href={apiDocumentos.url(empresaId, doc.id, true)} title="Baixar" aria-label="Baixar">
          <Icone nome="download" tamanho={16} />
        </a>
        {acao}
      </div>
    </li>
  );
}

function FormularioEnvio({ empresaId, opcoes, inicial, notificar, onCancelar, onEnviado }) {
  const [tipo, setTipo] = useState(inicial.tipo);
  const [descricao, setDescricao] = useState('');
  const [validade, setValidade] = useState('');
  const [arquivo, setArquivo] = useState(inicial.arquivo || null);
  const [erros, setErros] = useState({});
  const [progresso, setProgresso] = useState(null);
  const entrada = useRef(null);

  // Arquivo solto no painel enquanto o formulário já está aberto
  useEffect(() => {
    if (inicial.arquivo) setArquivo(inicial.arquivo);
  }, [inicial.arquivo]);

  const validar = () => {
    const novos = {};
    if (!arquivo) novos.arquivo = 'Selecione um arquivo.';
    else if (!opcoes.extensoes.includes(`.${extensaoDe(arquivo.name)}`)) {
      novos.arquivo = `Formato não permitido. Aceitos: ${opcoes.extensoes.join(', ')}.`;
    } else if (arquivo.size > opcoes.tamanhoMaximo) {
      novos.arquivo = `Arquivo maior que ${formatarTamanho(opcoes.tamanhoMaximo)}.`;
    }
    if (tipo === 'Outros' && !descricao.trim()) novos.descricao = 'Descreva o documento.';
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!validar()) return;
    setProgresso(0);
    try {
      const doc = await apiDocumentos.enviar(empresaId, { arquivo, tipo, descricao: descricao.trim(), validade }, setProgresso);
      onEnviado(doc);
    } catch (err) {
      setProgresso(null);
      if (err.campos) setErros(err.campos);
      notificar('erro', 'Não foi possível anexar', mensagemErro(err));
    }
  };

  const enviando = progresso !== null;

  return (
    <form className="form-envio" onSubmit={enviar} noValidate>
      <Campo id="doc-tipo" label="Tipo" obrigatorio erro={erros.tipo}>
        <select id="doc-tipo" className="entrada" value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={enviando}>
          {opcoes.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Campo>

      <Campo
        id="doc-descricao"
        label={tipo === 'Outros' ? 'Qual documento?' : 'Observação'}
        obrigatorio={tipo === 'Outros'}
        erro={erros.descricao}
      >
        <input
          id="doc-descricao"
          className={`entrada ${erros.descricao ? 'invalida' : ''}`}
          value={descricao}
          maxLength={150}
          onChange={(e) => { setDescricao(e.target.value); setErros((x) => ({ ...x, descricao: undefined })); }}
          disabled={enviando}
        />
      </Campo>

      <Campo id="doc-validade" label="Validade">
        <input id="doc-validade" type="date" className="entrada" value={validade}
          onChange={(e) => setValidade(e.target.value)} disabled={enviando} />
      </Campo>

      <div className="campo">
        <label
          className={`zona-arquivo ${arquivo ? 'com-arquivo' : ''} ${erros.arquivo ? 'invalida' : ''}`}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
          tabIndex={0}
        >
          <input
            ref={entrada}
            type="file"
            accept={opcoes.extensoes.join(',')}
            onChange={(e) => { setArquivo(e.target.files[0] || null); setErros((x) => ({ ...x, arquivo: undefined })); }}
            disabled={enviando}
            hidden
          />
          <Icone nome={arquivo ? 'arquivo' : 'upload'} tamanho={20} />
          {arquivo ? (
            <span><strong className="truncar">{arquivo.name}</strong><small>{formatarTamanho(arquivo.size)} · trocar</small></span>
          ) : (
            <span><strong>Escolha ou arraste</strong><small>PDF, imagem, DOCX ou XLSX · até {formatarTamanho(opcoes.tamanhoMaximo)}</small></span>
          )}
        </label>
        {erros.arquivo && <div className="campo-erro">{erros.arquivo}</div>}
      </div>

      {enviando && (
        <div className="progresso" role="progressbar" aria-valuenow={Math.round(progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ transform: `scaleX(${progresso})` }} />
        </div>
      )}

      <div className="botoes">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancelar} disabled={enviando}>Cancelar</button>
        <button type="submit" className="btn btn-primario btn-pequeno" disabled={enviando}>
          {enviando ? `Enviando ${Math.round(progresso * 100)}%` : 'Enviar'}
        </button>
      </div>
    </form>
  );
}

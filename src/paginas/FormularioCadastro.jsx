import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, mensagemErro } from '../api';
import {
  camposDe,
  formatarConsulta,
  formularioVazio,
  paraEnvio,
  paraFormulario,
  validarFormulario,
} from '../cadastros/campos';
import { tipoDe } from '../cadastros/tipos';
import Abas from '../components/Abas';
import Campo from '../components/Campo';
import Historico from '../components/Historico';
import Icone from '../components/Icone';
import ModalExclusao from '../components/ModalExclusao';
import PainelDocumentos from '../components/PainelDocumentos';
import { apenasDigitos, formatarDataHora, hojeISO } from '../utils/formatadores';

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Formulário de cadastro/edição montado a partir da configuração (src/cadastros).
// Os campos ficam divididos em abas; na edição aparece também a aba "Histórico".
export default function FormularioCadastro({ config, id, onNavegar, notificar }) {
  const edicao = Boolean(id);
  const campos = useMemo(() => camposDe(config), [config]);

  const [dados, setDados] = useState(() => formularioVazio(config));
  const [registro, setRegistro] = useState(null);
  const [erros, setErros] = useState({});
  const [aba, setAba] = useState(config.abas[0].id);
  const [carregando, setCarregando] = useState(edicao);
  const [erroCarga, setErroCarga] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [buscando, setBuscando] = useState(null); // campo com consulta externa em andamento
  const [opcoes, setOpcoes] = useState({}); // opções de selects carregadas da API
  const [historico, setHistorico] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [versaoHistorico, setVersaoHistorico] = useState(0); // muda quando um anexo é alterado
  const formulario = useRef(null);

  const excluido = Boolean(registro?.excluidoEm);
  const voltar = () => onNavegar({ pagina: 'lista', entidade: config.entidade });

  const exibirRegistro = useCallback((r) => {
    setRegistro(r);
    setDados(paraFormulario(config, r));
  }, [config]);

  // Carrega o registro na edição
  useEffect(() => {
    if (!edicao) return;
    api.obter(config.entidade, id)
      .then(exibirRegistro)
      .catch((e) => setErroCarga(mensagemErro(e)))
      .finally(() => setCarregando(false));
  }, [edicao, config.entidade, id, exibirRegistro]);

  // Carrega opções de selects que vêm da API (ex: lista de empresas)
  useEffect(() => {
    campos.filter((c) => c.carregarOpcoes).forEach((c) => {
      c.carregarOpcoes()
        .then((lista) => setOpcoes((prev) => ({ ...prev, [c.nome]: lista })))
        .catch(() => {});
    });
  }, [campos]);

  // Carrega o histórico sempre que a aba é aberta
  useEffect(() => {
    if (aba !== 'historico') return;
    setHistorico(null);
    api.historico(config.entidade, id)
      .then(setHistorico)
      .catch((e) => {
        setHistorico([]);
        notificar('erro', 'Erro ao carregar histórico', mensagemErro(e));
      });
  }, [aba, config.entidade, id, notificar, versaoHistorico]);

  // Ctrl+S (ou Cmd+S) salva o formulário
  useEffect(() => {
    const aoTeclar = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        formulario.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const mostrarErros = (novosErros) => {
    setErros(novosErros);
    const primeiroComErro = campos.find((c) => novosErros[c.nome]);
    if (primeiroComErro) setAba(primeiroComErro.aba);
  };

  // Consulta externa (CEP, CNPJ) que preenche outros campos automaticamente
  const completar = async (campo, digitos, dadosAntes) => {
    setBuscando(campo.nome);
    try {
      const resultado = await campo.completar.buscar(digitos);
      setDados((prev) => {
        const novo = { ...prev };
        for (const [nome, valor] of Object.entries(resultado)) {
          const destino = campos.find((c) => c.nome === nome);
          if (!destino || !valor || nome === campo.nome) continue;
          if (campo.completar.apenasVazios && String(prev[nome]).trim()) continue;
          novo[nome] = formatarConsulta(destino, valor);
        }
        return novo;
      });

      // Ex: o CNPJ trouxe o CEP -> busca o endereço pelo CEP também
      for (const destino of campos) {
        const valor = apenasDigitos(resultado[destino.nome]);
        if (destino.completar && destino !== campo && !String(dadosAntes[destino.nome]).trim()
          && valor.length === destino.completar.tamanho) {
          completar(destino, valor, dadosAntes);
        }
      }
    } catch (e) {
      setErros((prev) => ({ ...prev, [campo.nome]: mensagemErro(e) }));
    } finally {
      setBuscando((atual) => (atual === campo.nome ? null : atual));
    }
  };

  const alterar = (campo, valorDigitado) => {
    const tipo = tipoDe(campo);
    const valor = tipo.mascara ? tipo.mascara(valorDigitado) : valorDigitado;
    setDados((prev) => ({ ...prev, [campo.nome]: valor }));
    setErros((prev) => ({ ...prev, [campo.nome]: undefined }));

    const digitos = apenasDigitos(valor);
    if (campo.completar && digitos.length === campo.completar.tamanho
      && digitos !== apenasDigitos(dados[campo.nome]) && !tipo.validar?.(valor)) {
      completar(campo, digitos, dados);
    }
  };

  const salvar = async (e) => {
    e.preventDefault();
    const novosErros = validarFormulario(config, dados);
    if (Object.keys(novosErros).length > 0) {
      mostrarErros(novosErros);
      notificar('erro', 'Verifique os campos destacados');
      return;
    }

    setEnviando(true);
    try {
      const corpo = paraEnvio(config, dados);
      if (edicao) {
        await api.atualizar(config.entidade, id, corpo);
        notificar('sucesso', 'Alterações salvas');
        voltar();
      } else if (config.documentos) {
        // Cadastros com documentos abrem a edição logo depois, para anexar os arquivos
        const novo = await api.criar(config.entidade, corpo);
        notificar('sucesso', `${capitalizar(config.singular)} cadastrada`, 'Agora você já pode anexar os documentos.');
        onNavegar({ pagina: 'form', entidade: config.entidade, id: novo.id });
      } else {
        await api.criar(config.entidade, corpo);
        notificar('sucesso', `${capitalizar(config.singular)} cadastrada`);
        voltar();
      }
    } catch (err) {
      if (err.campos) mostrarErros(err.campos);
      notificar('erro', 'Não foi possível salvar', mensagemErro(err));
      setEnviando(false);
    }
  };

  const restaurar = async () => {
    try {
      exibirRegistro(await api.restaurar(config.entidade, id));
      notificar('sucesso', 'Registro restaurado');
    } catch (err) {
      notificar('erro', 'Não foi possível restaurar', mensagemErro(err));
    }
  };

  const excluir = async (motivo) => {
    await api.excluir(config.entidade, id, motivo);
    notificar('sucesso', 'Registro excluído', `${config.nomeExibicao(registro)} foi movido para Excluídos.`);
    voltar();
  };

  if (carregando) {
    return <div className="carregando"><span className="spinner" /></div>;
  }
  if (erroCarga) {
    return (
      <div className="estado">
        <span className="estado-icone erro"><Icone nome="alerta" tamanho={24} /></span>
        <p>{erroCarga}</p>
        <button className="btn btn-secundario btn-pequeno" onClick={voltar}>Voltar para a lista</button>
      </div>
    );
  }

  const renderCampo = (campo) => {
    const tipo = tipoDe(campo);
    const erro = erros[campo.nome];
    const props = {
      id: `campo-${campo.nome}`,
      name: campo.nome,
      value: dados[campo.nome] ?? '',
      onChange: (e) => alterar(campo, e.target.value),
      disabled: excluido,
      'aria-invalid': Boolean(erro),
      className: `entrada ${erro ? 'invalida' : ''}`,
    };
    const listaOpcoes = campo.opcoes || tipo.opcoes || opcoes[campo.nome];

    let controle;
    if (listaOpcoes || campo.carregarOpcoes) {
      const itens = (listaOpcoes || []).map((o) => (typeof o === 'string' ? { valor: o, label: o } : o));
      // Valor salvo que não está mais entre as opções (ex: empresa excluída)
      if (props.value && !itens.some((o) => o.valor === props.value)) {
        const label = campo.exibir ? campo.exibir(props.value, registro) : props.value;
        itens.push({ valor: props.value, label: `${label} (indisponível)` });
      }
      controle = (
        <select {...props}>
          <option value="">{campo.tipo === 'uf' ? '—' : 'Selecione...'}</option>
          {itens.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
        </select>
      );
    } else if (campo.tipo === 'textarea') {
      controle = <textarea {...props} rows={8} maxLength={campo.max} />;
    } else {
      controle = (
        <div className="campo-com-icone">
          <input
            {...props}
            type={tipo.input || 'text'}
            inputMode={tipo.inputMode}
            placeholder={campo.placeholder ?? tipo.placeholder}
            max={campo.tipo === 'data' ? hojeISO() : undefined}
            maxLength={campo.max}
          />
          {buscando === campo.nome && <span className="spinner" />}
        </div>
      );
    }

    const col = campo.col || 6;
    return (
      <Campo
        key={campo.nome}
        id={props.id}
        label={campo.label}
        obrigatorio={campo.obrigatorio}
        erro={erro}
        ajuda={buscando === campo.nome ? 'Buscando dados...' : null}
        col={col}
        colCelular={col <= 3 ? 6 : 12}
      >
        {controle}
      </Campo>
    );
  };

  const errosPorAba = campos.reduce((acc, c) => {
    if (erros[c.nome]) acc[c.aba] = (acc[c.aba] || 0) + 1;
    return acc;
  }, {});
  const abas = edicao ? [...config.abas, { id: 'historico', titulo: 'Histórico' }] : config.abas;
  const abaAtual = abas.find((a) => a.id === aba);

  const formularioPrincipal = (
    <form ref={formulario} onSubmit={salvar} noValidate className="painel">
      <Abas abas={abas} ativa={aba} onTrocar={setAba} contadores={errosPorAba} />

      <div className="painel-corpo">
        {aba === 'historico' ? (
          historico ? <Historico itens={historico} /> : <div className="carregando"><span className="spinner" /></div>
        ) : (
          <div className="grade" key={aba}>
            {abaAtual.campos.map((campo) => (!campo.visivel || campo.visivel(dados) ? renderCampo(campo) : null))}
          </div>
        )}
      </div>

      <div className="form-rodape">
        <span className="form-rodape-meta">
          {edicao && (
            <>
              Criado por {registro.criadoPor || '—'} em {formatarDataHora(registro.criadoEm)}
              {registro.atualizadoEm && <> · Alterado por {registro.atualizadoPor} em {formatarDataHora(registro.atualizadoEm)}</>}
            </>
          )}
        </span>
        <div className="botoes">
          {excluido ? (
            <button type="button" className="btn btn-secundario" onClick={voltar}>Voltar</button>
          ) : (
            <>
              {edicao && (
                <button type="button" className="btn btn-perigo-suave" onClick={() => setExcluindo(true)}>
                  <Icone nome="lixeira" tamanho={16} /> Excluir
                </button>
              )}
              <button type="button" className="btn btn-secundario" onClick={voltar}>Cancelar</button>
              <button type="submit" className="btn btn-primario" disabled={enviando} title="Salvar (Ctrl+S)">
                {enviando && <span className="spinner" />}
                {enviando ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-titulo">
          <button type="button" className="btn-icone voltar" onClick={voltar} aria-label="Voltar">
            <Icone nome="voltar" tamanho={20} />
          </button>
          <div className="min-w-0">
            <span className="page-sobretitulo">{edicao ? `Editar ${config.singular}` : config.plural}</span>
            <h1 className="page-title truncar">{edicao ? config.nomeExibicao(registro) : config.novo}</h1>
          </div>
        </div>
      </div>

      {excluido && (
        <div className="aviso aviso-erro">
          <Icone nome="lixeira" />
          <div className="aviso-texto">
            Excluído por <strong>{registro.excluidoPor}</strong> em {formatarDataHora(registro.excluidoEm)}
            <div className="limite-linhas" title={registro.motivoExclusao}>Motivo: {registro.motivoExclusao}</div>
          </div>
          <button type="button" className="btn btn-perigo-suave btn-pequeno" onClick={restaurar}>
            <Icone nome="restaurar" tamanho={15} /> Restaurar
          </button>
        </div>
      )}

      {config.documentos ? (
        <div className="layout-lateral">
          {formularioPrincipal}
          <aside className="lateral">
            <PainelDocumentos
              empresaId={id}
              bloqueado={excluido}
              notificar={notificar}
              onAlterar={() => setVersaoHistorico((v) => v + 1)}
            />
          </aside>
        </div>
      ) : formularioPrincipal}

      {excluindo && (
        <ModalExclusao
          descricao={<>Excluir <strong>{config.nomeExibicao(registro)}</strong>?</>}
          onConfirmar={excluir}
          onFechar={() => setExcluindo(false)}
        />
      )}
    </>
  );
}

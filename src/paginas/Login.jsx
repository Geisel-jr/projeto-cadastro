import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { conta, mensagemErro } from '../api';
import BotaoGoogle from '../components/BotaoGoogle';
import Campo from '../components/Campo';
import CampoSenha from '../components/CampoSenha';
import Icone from '../components/Icone';
import LayoutAcesso from '../components/LayoutAcesso';
import { confirmarCodigo, entrar, entrarComGoogle, reenviarCodigo } from '../sessao';
import { useTituloPagina } from '../rotas';

// Tremida curta no formulário quando algo falha (desligada para quem prefere menos movimento)
export function tremer(elemento) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  elemento?.animate?.(
    [{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' }, { transform: 'none' }],
    { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
  );
}

export default function Login({ onEntrar }) {
  useTituloPagina('Entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(null); // 'senha' | 'google' | null
  const [googleClientId, setGoogleClientId] = useState(null);
  const [demo, setDemo] = useState(null); // conta de demonstração, só quando ela existe
  const [desafio, setDesafio] = useState(null); // administradores: falta o código enviado por e-mail
  const formulario = useRef(null);
  const campoEmail = useRef(null);

  useEffect(() => {
    conta.configuracao().then((c) => {
      setGoogleClientId(c.googleClientId);
      setDemo(c.demo || null);
    }).catch(() => {});
  }, []);

  const falhar = (err) => {
    setErro(err.status === 429 ? 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.' : mensagemErro(err));
    setEnviando(null);
    tremer(formulario.current);
    // O e-mail costuma estar certo: devolve o cursor para a senha
    document.getElementById('login-senha')?.focus();
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!email.trim() || !senha) {
      setErro('Informe seu e-mail e sua senha.');
      tremer(formulario.current);
      (email.trim() ? document.getElementById('login-senha') : campoEmail.current)?.focus();
      return;
    }
    setErro(null);
    setEnviando('senha');
    try {
      const { usuario, mfa } = await entrar(email.trim(), senha);
      if (usuario) return onEntrar(usuario);
      setSenha('');
      setEnviando(null);
      setDesafio(mfa);
    } catch (err) {
      setSenha('');
      falhar(err);
    }
  };

  const entrarGoogle = async (credencial) => {
    setErro(null);
    setEnviando('google');
    try {
      onEntrar(await entrarComGoogle(credencial));
    } catch (err) {
      falhar(err);
    }
  };

  if (desafio) {
    return (
      <LayoutAcesso>
        <EtapaCodigo
          desafio={desafio}
          onEntrar={onEntrar}
          onVoltar={(mensagem) => {
            setDesafio(null);
            setErro(mensagem || null);
          }}
        />
      </LayoutAcesso>
    );
  }

  return (
    <LayoutAcesso>
      <form className="login-campos" onSubmit={enviar} noValidate ref={formulario}>
        <h1>Entrar</h1>
        <p className="login-subtitulo">Use o e-mail cadastrado pelo administrador.</p>

        {demo && <AcessoDemonstracao demo={demo} />}

        {erro && (
          <div className="aviso aviso-erro" role="alert">
            <Icone nome="alerta" />
            <span className="aviso-texto">{erro}</span>
          </div>
        )}

        <Campo id="login-email" label="E-mail">
          <input
            ref={campoEmail}
            id="login-email"
            type="email"
            className="entrada"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoFocus
            maxLength={150}
            readOnly={Boolean(enviando)} // readOnly, e não disabled: campo desabilitado perde o foco
          />
        </Campo>

        <Campo id="login-senha" label="Senha">
          <CampoSenha
            id="login-senha"
            valor={senha}
            onChange={setSenha}
            autoComplete="current-password"
            readOnly={Boolean(enviando)}
          />
        </Campo>
        <Link className="link-esqueci" to="/esqueci-senha" state={{ email: email.trim() }}>Esqueci minha senha</Link>

        <button type="submit" className="btn btn-primario btn-grande" disabled={Boolean(enviando)}>
          {enviando === 'senha' ? <><span className="spinner" /> Entrando...</> : 'Entrar'}
        </button>

        {googleClientId && (
          <>
            <div className="divisor"><span>ou</span></div>
            <div className={`login-google ${enviando ? 'ocupado' : ''}`}>
              <BotaoGoogle clientId={googleClientId} onCredencial={entrarGoogle} onErro={setErro} />
              {enviando === 'google' && <span className="spinner" aria-label="Entrando com Google" />}
            </div>
          </>
        )}

        <p className="login-ajuda">
          <Icone nome="cadeado" tamanho={14} />
          Não tem acesso? Peça a um administrador do sistema.
        </p>
      </form>
    </LayoutAcesso>
  );
}

// Dados da conta de demonstração (só aparece enquanto ela existe com a senha pública).
// Não preenche o formulário: a pessoa copia e cola, como faria com uma conta real.
function AcessoDemonstracao({ demo }) {
  const [copiado, setCopiado] = useState(null);

  const copiar = async (campo, valor) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(campo);
      setTimeout(() => setCopiado((atual) => (atual === campo ? null : atual)), 1500);
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para o Ctrl+C
      window.getSelection()?.selectAllChildren(document.getElementById(`demo-${campo}`));
    }
  };

  return (
    <div className="acesso-demo" role="note" aria-labelledby="acesso-demo-titulo">
      <p className="acesso-demo-titulo" id="acesso-demo-titulo">
        <Icone nome="chave" tamanho={14} /> Conta de demonstração
      </p>
      <dl>
        {[['email', 'E-mail', demo.email], ['senha', 'Senha', demo.senha]].map(([campo, rotulo, valor]) => (
          <div className="acesso-demo-linha" key={campo}>
            <dt>{rotulo}</dt>
            <dd id={`demo-${campo}`}>{valor}</dd>
            <button
              type="button"
              className="btn-copiar"
              onClick={() => copiar(campo, valor)}
              aria-label={copiado === campo ? `${rotulo} copiado` : `Copiar ${rotulo.toLowerCase()}`}
            >
              {copiado === campo ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Segunda etapa do login dos administradores: o código de 6 números enviado por e-mail
function EtapaCodigo({ desafio, onEntrar, onVoltar }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [espera, setEspera] = useState(desafio.reenviarEm); // segundos até liberar o reenvio
  const [reenvios, setReenvios] = useState(desafio.reenvios);
  const formulario = useRef(null);
  const campo = useRef(null);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const relogio = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(relogio);
  }, [espera]);

  const falhar = (err) => {
    // Código expirado ou erros demais: só entrando com a senha de novo
    if (err.status === 410) return onVoltar(err.message);
    setErro(mensagemErro(err));
    setAviso(null);
    setCodigo('');
    setEnviando(false);
    tremer(formulario.current);
    campo.current?.focus();
  };

  const confirmar = async (valor) => {
    if (enviando) return;
    if (valor.length !== 6) {
      setErro('Digite os 6 números do código.');
      tremer(formulario.current);
      campo.current?.focus();
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      onEntrar(await confirmarCodigo(desafio.desafio, valor));
    } catch (err) {
      falhar(err);
    }
  };

  const digitar = (e) => {
    const valor = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCodigo(valor);
    setErro(null);
    if (valor.length === 6) confirmar(valor); // colou o código ou digitou o último número
  };

  const reenviar = async () => {
    setErro(null);
    setReenviando(true);
    try {
      const novo = await reenviarCodigo(desafio.desafio);
      setEspera(novo.reenviarEm);
      setReenvios(novo.reenvios);
      setCodigo('');
      setAviso('Enviamos um código novo. O anterior deixou de valer.');
      campo.current?.focus();
    } catch (err) {
      if (err.status === 410) return onVoltar(err.message);
      setErro(mensagemErro(err));
    } finally {
      setReenviando(false);
    }
  };

  return (
    <form
      className="login-campos login-confirmacao"
      onSubmit={(e) => { e.preventDefault(); confirmar(codigo); }}
      noValidate
      ref={formulario}
    >
      <button type="button" className="link-voltar-acesso" onClick={() => onVoltar()}>
        <Icone nome="voltar" tamanho={15} /> Voltar
      </button>
      <h1>Confirme que é você</h1>
      <p className="login-subtitulo">
        Enviamos um código de 6 números para <strong>{desafio.email}</strong>. Ele vale por {desafio.minutos} minutos.
      </p>

      {erro ? (
        <div className="aviso aviso-erro" role="alert">
          <Icone nome="alerta" />
          <span className="aviso-texto">{erro}</span>
        </div>
      ) : aviso && (
        <div className="aviso aviso-info" role="status">
          <Icone nome="email" />
          <span className="aviso-texto">{aviso}</span>
        </div>
      )}

      <Campo id="login-codigo" label="Código de acesso">
        <input
          ref={campo}
          id="login-codigo"
          className="entrada entrada-codigo"
          value={codigo}
          onChange={digitar}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          spellCheck={false}
          readOnly={enviando} // readOnly, e não disabled: o cursor continua no campo se o código falhar
        />
      </Campo>

      <button type="submit" className="btn btn-primario btn-grande" disabled={enviando}>
        {enviando ? <><span className="spinner" /> Confirmando...</> : 'Confirmar'}
      </button>

      <p className="login-dica">
        Não chegou? Veja a caixa de spam
        {reenvios <= 0 ? ' ou volte e entre de novo.' : espera > 0 ? ` ou peça outro código em ${espera}s.` : (
          <> ou <button type="button" className="link-reenviar" onClick={reenviar} disabled={reenviando}>envie outro código</button>.</>
        )}
      </p>
    </form>
  );
}

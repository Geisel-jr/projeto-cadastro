import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { conta, mensagemErro } from '../api';
import BotaoGoogle from '../components/BotaoGoogle';
import Campo from '../components/Campo';
import CampoSenha from '../components/CampoSenha';
import Icone from '../components/Icone';
import LayoutAcesso from '../components/LayoutAcesso';
import { entrar, entrarComGoogle } from '../sessao';
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
  const formulario = useRef(null);
  const campoEmail = useRef(null);

  useEffect(() => {
    conta.configuracao().then((c) => setGoogleClientId(c.googleClientId)).catch(() => {});
  }, []);

  const falhar = (err) => {
    setErro(err.status === 429 ? 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.' : mensagemErro(err));
    setEnviando(null);
    tremer(formulario.current);
    // O e-mail costuma estar certo: devolve o cursor para a senha
    setTimeout(() => document.getElementById('login-senha')?.focus(), 0);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro('Informe seu e-mail e sua senha.');
      tremer(formulario.current);
      (email.trim() ? document.getElementById('login-senha') : campoEmail.current)?.focus();
      return;
    }
    setErro(null);
    setEnviando('senha');
    try {
      onEntrar(await entrar(email.trim(), senha));
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

  return (
    <LayoutAcesso>
      <form className="login-campos" onSubmit={enviar} noValidate ref={formulario}>
        <h1>Entrar</h1>
        <p className="login-subtitulo">Use o e-mail cadastrado pelo administrador.</p>

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
            disabled={Boolean(enviando)}
          />
        </Campo>

        <Campo id="login-senha" label="Senha">
          <CampoSenha
            id="login-senha"
            valor={senha}
            onChange={setSenha}
            autoComplete="current-password"
            disabled={Boolean(enviando)}
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

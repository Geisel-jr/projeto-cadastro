import { useEffect, useRef, useState } from 'react';
import { conta, mensagemErro } from '../api';
import BotaoGoogle from '../components/BotaoGoogle';
import Campo from '../components/Campo';
import CampoSenha from '../components/CampoSenha';
import Icone from '../components/Icone';
import { entrar, entrarComGoogle } from '../sessao';
import { corAvatar, iniciais } from '../utils/formatadores';

// Exemplo ilustrativo do histórico de auditoria, mostrado no painel da marca
const EXEMPLO_HISTORICO = [
  { quem: 'Ana Ribeiro', acao: 'anexou o cartão CNPJ', alvo: 'Pão Quente', quando: 'agora' },
  { quem: 'Carlos Mendes', acao: 'editou o telefone de', alvo: 'Banco do Brasil', quando: 'há 4 min' },
  { quem: 'Júlia Prado', acao: 'restaurou', alvo: 'Maria Albuquerque', quando: 'há 12 min' },
];

export default function Login({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(null); // 'senha' | 'google' | null
  const [googleClientId, setGoogleClientId] = useState(null);
  const formulario = useRef(null);
  const campoEmail = useRef(null);

  // Tremida curta no formulário quando o login falha (desligada para quem prefere menos movimento)
  const tremer = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    formulario.current?.animate?.(
      [{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' }, { transform: 'none' }],
      { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    );
  };

  useEffect(() => {
    conta.configuracao().then((c) => setGoogleClientId(c.googleClientId)).catch(() => {});
  }, []);

  const falhar = (err) => {
    setErro(err.status === 429 ? 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.' : mensagemErro(err));
    setEnviando(null);
    tremer();
    // O e-mail costuma estar certo: devolve o cursor para a senha
    setTimeout(() => document.getElementById('login-senha')?.focus(), 0);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro('Informe seu e-mail e sua senha.');
      tremer();
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
    <div className="login">
      <aside className="login-marca" aria-hidden="true">
        <div className="marca marca-clara">
          <span className="marca-logo" />
          <span className="marca-nome">Cadastro<strong>Hub</strong></span>
        </div>

        <div className="login-manifesto">
          <h2>Cada cadastro guarda a história de quem mexeu nele.</h2>
          <ul className="login-historico">
            {EXEMPLO_HISTORICO.map((item, i) => (
              <li key={item.quem} style={{ '--i': i }}>
                <span className="avatar colorido" style={corAvatar(item.quem)}>{iniciais(item.quem)}</span>
                <span>
                  <strong>{item.quem}</strong> {item.acao} <strong>{item.alvo}</strong>
                  <small>{item.quando}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="login-rodape">Empresas, pessoas e documentos com auditoria completa.</p>
      </aside>

      <main className="login-area">
        <form className="login-form" onSubmit={enviar} noValidate ref={formulario}>
          <div className="marca login-marca-movel">
            <span className="marca-logo" aria-hidden="true" />
            <span className="marca-nome">Cadastro<strong>Hub</strong></span>
          </div>

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
      </main>
    </div>
  );
}

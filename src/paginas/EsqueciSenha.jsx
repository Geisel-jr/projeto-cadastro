import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { conta, mensagemErro } from '../api';
import Campo from '../components/Campo';
import Icone from '../components/Icone';
import LayoutAcesso from '../components/LayoutAcesso';
import { useTituloPagina } from '../rotas';
import { tremer } from './Login';

// Pedido do link de redefinição. A resposta é sempre a mesma, exista ou não a conta.
export default function EsqueciSenha() {
  useTituloPagina('Esqueci minha senha');
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email || '');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState(null);
  const formulario = useRef(null);

  const enviar = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErro('Informe um e-mail válido.');
      tremer(formulario.current);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await conta.esqueciSenha(email.trim());
      setEnviadoPara(email.trim());
    } catch (err) {
      setErro(err.status === 429 ? 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.' : mensagemErro(err));
      tremer(formulario.current);
    } finally {
      setEnviando(false);
    }
  };

  if (enviadoPara) {
    return (
      <LayoutAcesso>
        <div className="login-campos login-confirmacao" role="status">
          <span className="estado-icone sucesso"><Icone nome="email" tamanho={20} /></span>
          <h1>Confira seu e-mail</h1>
          <p className="login-subtitulo">
            Se houver uma conta com <strong>{enviadoPara}</strong>, você vai receber um link para criar uma
            nova senha. Ele vale por 30 minutos.
          </p>
          <p className="login-dica">Não chegou? Veja a caixa de spam ou peça de novo em alguns minutos.</p>
          <Link className="btn btn-secundario btn-grande" to="/">Voltar ao login</Link>
        </div>
      </LayoutAcesso>
    );
  }

  return (
    <LayoutAcesso>
      <form className="login-campos" onSubmit={enviar} noValidate ref={formulario}>
        <Link className="link-voltar-acesso" to="/">
          <Icone nome="voltar" tamanho={15} /> Voltar ao login
        </Link>
        <h1>Esqueci minha senha</h1>
        <p className="login-subtitulo">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>

        {erro && (
          <div className="aviso aviso-erro" role="alert">
            <Icone nome="alerta" />
            <span className="aviso-texto">{erro}</span>
          </div>
        )}

        <Campo id="esqueci-email" label="E-mail">
          <input
            id="esqueci-email"
            type="email"
            className="entrada"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoFocus
            maxLength={150}
            disabled={enviando}
          />
        </Campo>

        <button type="submit" className="btn btn-primario btn-grande" disabled={enviando}>
          {enviando ? <><span className="spinner" /> Enviando...</> : 'Enviar link'}
        </button>
      </form>
    </LayoutAcesso>
  );
}

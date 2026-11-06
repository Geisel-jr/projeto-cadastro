import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { conta, mensagemErro } from '../api';
import Campo from '../components/Campo';
import CampoSenha from '../components/CampoSenha';
import Icone from '../components/Icone';
import LayoutAcesso from '../components/LayoutAcesso';
import RequisitosSenha, { senhaAtendeRequisitos } from '../components/RequisitosSenha';
import { useTituloPagina } from '../rotas';
import { tremer } from './Login';

// O código do link é lido e tirado da barra de endereço, para não ficar no histórico
// do navegador nem ser exposto a quem olhar a tela. Fica guardado aqui porque o React,
// em desenvolvimento, chama esta função duas vezes (e na segunda a URL já está limpa).
let ultimoCodigoLido = '';
function lerCodigoDoLink() {
  const codigo = new URLSearchParams(window.location.search).get('token');
  if (codigo) {
    ultimoCodigoLido = codigo;
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  return ultimoCodigoLido;
}

// Tela aberta pelo link do e-mail: confere o link e cria a nova senha
export default function RedefinirSenha() {
  useTituloPagina('Criar nova senha');
  const navigate = useNavigate();
  const [codigo] = useState(lerCodigoDoLink);
  const [etapa, setEtapa] = useState('verificando'); // verificando | invalido | formulario | concluido
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef(null);

  useEffect(() => {
    if (!codigo) {
      setEtapa('invalido');
      return;
    }
    conta.verificarLink(codigo)
      .then((dados) => {
        setEmail(dados.email);
        setEtapa('formulario');
      })
      .catch(() => setEtapa('invalido'));
  }, [codigo]);

  const salvar = async (e) => {
    e.preventDefault();
    const novos = {};
    if (!senhaAtendeRequisitos(senha)) novos.senha = 'A senha não atende aos requisitos.';
    else if (senha !== confirmacao) novos.confirmacao = 'As senhas não conferem.';
    setErros(novos);
    if (Object.keys(novos).length) {
      tremer(formulario.current);
      return;
    }

    setEnviando(true);
    try {
      await conta.redefinirSenha(codigo, senha);
      setEtapa('concluido');
    } catch (err) {
      if (err.status === 400 && !err.campos) setEtapa('invalido'); // link venceu enquanto a tela estava aberta
      else setErros(err.campos ? { senha: err.campos.novaSenha } : { geral: mensagemErro(err) });
      setEnviando(false);
    }
  };

  let conteudo;
  if (etapa === 'verificando') {
    conteudo = <div className="carregando"><span className="spinner" aria-label="Conferindo o link" /></div>;
  } else if (etapa === 'invalido') {
    conteudo = (
      <div className="login-campos login-confirmacao">
        <span className="estado-icone erro"><Icone nome="alerta" tamanho={20} /></span>
        <h1>Link inválido ou expirado</h1>
        <p className="login-subtitulo">
          Os links de redefinição valem por 30 minutos e só podem ser usados uma vez. Peça um novo link.
        </p>
        <Link className="btn btn-primario btn-grande" to="/esqueci-senha">Pedir novo link</Link>
        <Link className="link-esqueci centro" to="/">Voltar ao login</Link>
      </div>
    );
  } else if (etapa === 'concluido') {
    conteudo = (
      <div className="login-campos login-confirmacao" role="status">
        <span className="estado-icone sucesso"><Icone nome="check" tamanho={20} /></span>
        <h1>Senha alterada</h1>
        <p className="login-subtitulo">
          Sua nova senha já vale. Por segurança, as sessões abertas com a senha antiga foram encerradas.
        </p>
        <button className="btn btn-primario btn-grande" onClick={() => navigate('/', { replace: true })}>Entrar</button>
      </div>
    );
  } else {
    conteudo = (
      <form className="login-campos" onSubmit={salvar} noValidate ref={formulario}>
        <h1>Criar nova senha</h1>
        <p className="login-subtitulo">Para a conta <strong>{email}</strong>.</p>

        {erros.geral && (
          <div className="aviso aviso-erro" role="alert">
            <Icone nome="alerta" />
            <span className="aviso-texto">{erros.geral}</span>
          </div>
        )}

        <Campo id="nova-senha" label="Nova senha" erro={erros.senha}>
          <CampoSenha id="nova-senha" valor={senha} onChange={setSenha} invalido={erros.senha}
            autoComplete="new-password" autoFocus disabled={enviando} />
        </Campo>
        <RequisitosSenha senha={senha} />
        <Campo id="confirmar-senha" label="Confirme a nova senha" erro={erros.confirmacao}>
          <CampoSenha id="confirmar-senha" valor={confirmacao} onChange={setConfirmacao} invalido={erros.confirmacao}
            autoComplete="new-password" disabled={enviando} />
        </Campo>

        <button type="submit" className="btn btn-primario btn-grande" disabled={enviando}>
          {enviando ? <><span className="spinner" /> Salvando...</> : 'Salvar nova senha'}
        </button>
      </form>
    );
  }

  return <LayoutAcesso>{conteudo}</LayoutAcesso>;
}

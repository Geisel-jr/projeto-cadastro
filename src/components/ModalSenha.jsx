import { useState } from 'react';
import { conta, mensagemErro } from '../api';
import Campo from './Campo';
import CampoSenha from './CampoSenha';
import Icone from './Icone';
import Modal from './Modal';

// Requisitos mostrados enquanto a pessoa digita (os mesmos que a API exige)
const REQUISITOS = [
  { texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
  { texto: 'Letras e números', ok: (s) => /\p{L}/u.test(s) && /\d/.test(s) },
];

// Troca de senha. "obrigatoria" = senha provisória: não dá para fechar, só trocar ou sair.
export default function ModalSenha({ usuario, obrigatoria = false, onConcluir, onFechar, onSair }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const pedeAtual = usuario.temSenha;

  const salvar = async (e) => {
    e.preventDefault();
    const novos = {};
    if (pedeAtual && !senhaAtual) novos.senhaAtual = 'Informe a senha atual.';
    if (!REQUISITOS.every((r) => r.ok(novaSenha))) novos.novaSenha = 'A senha não atende aos requisitos.';
    else if (novaSenha !== confirmacao) novos.confirmacao = 'As senhas não conferem.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      onConcluir(await conta.trocarSenha(senhaAtual, novaSenha));
    } catch (err) {
      setErros(err.campos || { geral: mensagemErro(err) });
      setEnviando(false);
    }
  };

  const titulo = obrigatoria ? 'Crie sua senha' : pedeAtual ? 'Alterar senha' : 'Criar senha';

  return (
    <Modal
      titulo={titulo}
      onFechar={obrigatoria || enviando ? undefined : onFechar}
      rodape={(fechar) => (
        <>
          {obrigatoria ? (
            <button className="btn btn-secundario" onClick={onSair} disabled={enviando}>
              <Icone nome="sair" tamanho={15} /> Sair
            </button>
          ) : (
            <button className="btn btn-secundario" onClick={fechar} disabled={enviando}>Cancelar</button>
          )}
          <button className="btn btn-primario" type="submit" form="form-senha" disabled={enviando}>
            {enviando && <span className="spinner" />}
            {enviando ? 'Salvando...' : 'Salvar senha'}
          </button>
        </>
      )}
    >
      {obrigatoria && <p>Sua senha atual é provisória. Escolha uma senha só sua para continuar.</p>}
      {!obrigatoria && <p>As outras sessões abertas com a sua conta serão encerradas.</p>}
      <form id="form-senha" onSubmit={salvar} className="form-senha" noValidate>
        {erros.geral && <div className="aviso aviso-erro" role="alert"><Icone nome="alerta" /><span className="aviso-texto">{erros.geral}</span></div>}
        {pedeAtual && (
          <Campo id="senha-atual" label={obrigatoria ? 'Senha provisória' : 'Senha atual'} erro={erros.senhaAtual}>
            <CampoSenha id="senha-atual" valor={senhaAtual} onChange={setSenhaAtual} invalido={erros.senhaAtual}
              autoComplete="current-password" autoFocus />
          </Campo>
        )}
        <Campo id="nova-senha" label="Nova senha" erro={erros.novaSenha}>
          <CampoSenha id="nova-senha" valor={novaSenha} onChange={setNovaSenha} invalido={erros.novaSenha}
            autoComplete="new-password" autoFocus={!pedeAtual} />
        </Campo>
        <ul className="requisitos" aria-label="Requisitos da senha">
          {REQUISITOS.map((r) => (
            <li key={r.texto} className={r.ok(novaSenha) ? 'ok' : ''}>
              <Icone nome="check" tamanho={13} /> {r.texto}
            </li>
          ))}
        </ul>
        <Campo id="confirmar-senha" label="Confirme a nova senha" erro={erros.confirmacao}>
          <CampoSenha id="confirmar-senha" valor={confirmacao} onChange={setConfirmacao} invalido={erros.confirmacao}
            autoComplete="new-password" />
        </Campo>
      </form>
    </Modal>
  );
}

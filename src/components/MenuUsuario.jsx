import { useEffect, useRef, useState } from 'react';
import { corAvatar, iniciais } from '../utils/formatadores';
import Icone from './Icone';

export function Avatar({ usuario, pequeno = false }) {
  if (usuario.fotoUrl) {
    return <img className={`avatar ${pequeno ? 'pequeno' : ''}`} src={usuario.fotoUrl} alt="" referrerPolicy="no-referrer" />;
  }
  return <span className={`avatar colorido ${pequeno ? 'pequeno' : ''}`} style={corAvatar(usuario.nome)}>{iniciais(usuario.nome)}</span>;
}

// Botão com o usuário logado no topo; abre um menu com a conta, troca de senha e saída
export default function MenuUsuario({ usuario, onTrocarSenha, onSair }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicar = (e) => !raiz.current?.contains(e.target) && setAberto(false);
    const aoTeclar = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const escolher = (acao) => () => {
    setAberto(false);
    acao();
  };

  return (
    <div className="menu-usuario" ref={raiz}>
      <button
        className="operador"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={usuario.nome}
      >
        <Avatar usuario={usuario} pequeno />
        <span className="operador-nome truncar">{usuario.nome}</span>
        <Icone nome="seta-baixo" tamanho={14} className="operador-seta" />
      </button>

      {aberto && (
        <div className="menu-usuario-painel" role="menu">
          <div className="menu-usuario-conta">
            <Avatar usuario={usuario} />
            <div className="min-w-0">
              <strong className="truncar">{usuario.nome}</strong>
              <small className="truncar">{usuario.email}</small>
              <span className="selo">{usuario.papel === 'admin' ? 'Administrador' : 'Operador'}</span>
            </div>
          </div>
          <button role="menuitem" className="menu-usuario-item" onClick={escolher(onTrocarSenha)}>
            <Icone nome="chave" tamanho={16} /> {usuario.temSenha ? 'Alterar senha' : 'Criar senha'}
          </button>
          <button role="menuitem" className="menu-usuario-item" onClick={escolher(onSair)}>
            <Icone nome="sair" tamanho={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

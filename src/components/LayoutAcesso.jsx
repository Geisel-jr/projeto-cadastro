import { corAvatar, iniciais } from '../utils/formatadores';

// Exemplo ilustrativo do histórico de auditoria, mostrado no painel da marca
const EXEMPLO_HISTORICO = [
  { quem: 'Ana Ribeiro', acao: 'anexou o cartão CNPJ', alvo: 'Pão Quente', quando: 'agora' },
  { quem: 'Carlos Mendes', acao: 'editou o telefone de', alvo: 'Banco do Brasil', quando: 'há 4 min' },
  { quem: 'Júlia Prado', acao: 'restaurou', alvo: 'Maria Albuquerque', quando: 'há 12 min' },
];

// Moldura das telas de acesso (login, esqueci a senha, nova senha):
// painel escuro da marca à esquerda e o conteúdo à direita. No celular, só o conteúdo.
export default function LayoutAcesso({ children }) {
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
        <div className="login-form">
          <div className="marca login-marca-movel">
            <span className="marca-logo" aria-hidden="true" />
            <span className="marca-nome">Cadastro<strong>Hub</strong></span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

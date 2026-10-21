import { useEffect, useRef } from 'react';

// Carrega a biblioteca oficial do Google (Google Identity Services) uma única vez
let carregamento;
function carregarGoogle() {
  carregamento ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      carregamento = null; // permite tentar de novo
      reject(new Error('Não foi possível carregar o login com Google.'));
    };
    document.head.appendChild(script);
  });
  return carregamento;
}

// Botão "Fazer login com o Google" desenhado pelo próprio Google (exigência da marca).
// O Google devolve um ID token (JWT) que é enviado à nossa API para ser validado.
export default function BotaoGoogle({ clientId, onCredencial, onErro }) {
  const caixa = useRef(null);
  const retornos = useRef({ onCredencial, onErro });
  retornos.current = { onCredencial, onErro };

  useEffect(() => {
    let ativo = true;
    carregarGoogle()
      .then(() => {
        if (!ativo || !caixa.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resposta) => retornos.current.onCredencial(resposta.credential),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(caixa.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'pt-BR',
          width: Math.min(caixa.current.offsetWidth || 360, 400),
        });
      })
      .catch((erro) => ativo && retornos.current.onErro?.(erro.message));
    return () => { ativo = false; };
  }, [clientId]);

  return <div ref={caixa} className="botao-google" />;
}

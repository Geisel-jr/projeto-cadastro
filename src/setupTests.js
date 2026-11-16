// Roda antes de cada arquivo de teste (configurado em vite.config.js).
// jest-dom acrescenta verificações como toBeInTheDocument() e toHaveValue().
import '@testing-library/jest-dom/vitest';

// O jsdom não rola a página; sem isto, cada troca de rota enche o log de erros "Not implemented"
window.scrollTo = () => {};

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// O ambiente de testes do create-react-app (jsdom antigo) não tem TextEncoder,
// usado pelo react-router. Aqui ele é emprestado do Node.
import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder;

import { useEffect } from 'react';

// As páginas navegam com objetos { pagina, entidade, id }; aqui eles viram endereços:
//   { pagina: 'painel' }                          -> /
//   { pagina: 'lista', entidade: 'empresas' }     -> /empresas
//   { pagina: 'form', entidade: 'empresas' }      -> /empresas/nova
//   { pagina: 'form', entidade: 'empresas', id }  -> /empresas/12
//   { pagina: 'auditoria' } / { pagina: 'usuarios' }
export function caminhoDe(rota) {
  switch (rota.pagina) {
    case 'lista':
      return `/${rota.entidade}`;
    case 'form':
      return `/${rota.entidade}/${rota.id ?? 'nova'}`;
    case 'auditoria':
    case 'usuarios':
      return `/${rota.pagina}`;
    default:
      return '/';
  }
}

// Título da aba do navegador: "Empresas · CadastroHub"
export function useTituloPagina(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · CadastroHub` : 'CadastroHub';
  }, [titulo]);
}

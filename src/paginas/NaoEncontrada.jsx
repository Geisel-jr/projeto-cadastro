import { Link } from 'react-router';
import Icone from '../components/Icone';
import { useTituloPagina } from '../rotas';

// Endereço que não existe (ou que a pessoa não tem permissão para ver)
export default function NaoEncontrada() {
  useTituloPagina('Página não encontrada');
  return (
    <div className="estado nao-encontrada">
      <span className="estado-icone"><Icone nome="busca" tamanho={24} /></span>
      <h1>Página não encontrada</h1>
      <p>O endereço não existe ou você não tem acesso a ele.</p>
      <Link className="btn btn-secundario" to="/">Voltar ao painel</Link>
    </div>
  );
}

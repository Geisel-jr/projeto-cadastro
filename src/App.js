import { useState } from 'react';
import FormEmpresa from './FormEmpresa';
import FormPessoa from './FormPessoa';

function App() {
  const [tela, setTela] = useState('inicio');

  return (
    <div>
      {tela === 'inicio' && (
        <div className="d-flex align-items-center justify-content-center vh-100 bg-primary">
          <div className="text-center">
            <h1 className="text-white mb-5 display-3">Sistema de Cadastro</h1>
            
            <button
              onClick={() => setTela('empresa')}
              className="btn btn-info btn-lg me-3 mb-3"
              style={{ padding: '15px 40px', fontSize: '18px' }}
            >
              Cadastro de Empresa
            </button>
            
            <button
              onClick={() => setTela('pessoa')}
              className="btn btn-success btn-lg mb-3"
              style={{ padding: '15px 40px', fontSize: '18px' }}
            >
              Cadastro de Pessoa
            </button>
          </div>
        </div>
      )}

      {tela === 'empresa' && <FormEmpresa onVoltar={() => setTela('inicio')} />}
      {tela === 'pessoa' && <FormPessoa onVoltar={() => setTela('inicio')} />}
    </div>
  );
}

export default App;
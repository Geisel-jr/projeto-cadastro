import { useState } from 'react';

export default function FormEmpresa({ onVoltar }) {
  const [dados, setDados] = useState({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: ''
  });

  const handleChange = (e) => {
    setDados({
      ...dados,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Empresa cadastrada:', dados);
    alert('✅ Empresa cadastrada com sucesso!');
    setDados({ nome: '', cnpj: '', email: '', telefone: '', endereco: '', cidade: '' });
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '450px' }}>
        <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">📊 Cadastro de Empresa</h4>
          <button onClick={onVoltar} className="btn btn-sm btn-light">✕</button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-bold">Nome da Empresa *</label>
              <input
                type="text"
                name="nome"
                value={dados.nome}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="Ex: Empresa XYZ"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">CNPJ *</label>
              <input
                type="text"
                name="cnpj"
                value={dados.cnpj}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Email *</label>
              <input
                type="email"
                name="email"
                value={dados.email}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="empresa@email.com"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Telefone *</label>
              <input
                type="tel"
                name="telefone"
                value={dados.telefone}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Endereço</label>
              <input
                type="text"
                name="endereco"
                value={dados.endereco}
                onChange={handleChange}
                className="form-control"
                placeholder="Rua, número..."
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Cidade</label>
              <input
                type="text"
                name="cidade"
                value={dados.cidade}
                onChange={handleChange}
                className="form-control"
                placeholder="Sua cidade"
              />
            </div>

            <button type="submit" className="btn btn-info w-100 fw-bold py-2">
              Cadastrar Empresa
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
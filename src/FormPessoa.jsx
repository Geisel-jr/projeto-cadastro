import { useState } from 'react';

export default function FormPessoa({ onVoltar }) {
  const [dados, setDados] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    profissao: ''
  });

  const handleChange = (e) => {
    setDados({
      ...dados,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Pessoa cadastrada:', dados);
    alert('✅ Pessoa cadastrada com sucesso!');
    setDados({ nome: '', cpf: '', email: '', telefone: '', dataNascimento: '', profissao: '' });
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '450px' }}>
        <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">👤 Cadastro de Pessoa</h4>
          <button onClick={onVoltar} className="btn btn-sm btn-light">✕</button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-bold">Nome Completo *</label>
              <input
                type="text"
                name="nome"
                value={dados.nome}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="Seu nome completo"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">CPF *</label>
              <input
                type="text"
                name="cpf"
                value={dados.cpf}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="000.000.000-00"
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
                placeholder="seu@email.com"
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
              <label className="form-label fw-bold">Data de Nascimento *</label>
              <input
                type="date"
                name="dataNascimento"
                value={dados.dataNascimento}
                onChange={handleChange}
                required
                className="form-control"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Profissão</label>
              <input
                type="text"
                name="profissao"
                value={dados.profissao}
                onChange={handleChange}
                className="form-control"
                placeholder="Sua profissão"
              />
            </div>

            <button type="submit" className="btn btn-success w-100 fw-bold py-2">
              Cadastrar Pessoa
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
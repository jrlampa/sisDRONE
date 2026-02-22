import React, { useState } from 'react';
import { api } from '../services/api';
import { Zap, LogIn } from 'lucide-react';
import type { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      const { token, user } = res.data;
      localStorage.setItem('sisdrone_jwt', token);
      localStorage.setItem('sisdrone_user', JSON.stringify(user));
      localStorage.setItem('sisdrone_mock_role', user.role);
      onLogin(user);
    } catch {
      setError('Usuário ou senha inválidos. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-header">
          <Zap className="text-accent" size={48} />
          <h1 className="logo-text">sisDRONE</h1>
          <p className="login-subtitle">SISTEMA DE INSPEÇÃO AUTOMATIZADA</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-username">Usuário</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="glass-input"
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="glass-input"
              required
            />
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || !username.trim()}
          >
            <LogIn size={18} />
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
        <p className="login-hint">
          Usuários: admin, eng1, eng2 · Senha padrão: sisdrone123
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

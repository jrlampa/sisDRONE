import React, { useState } from 'react';
import { api } from '../services/api';
import { Zap, LogIn, UserPlus } from 'lucide-react';
import type { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

type Tab = 'login' | 'register';

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [tab, setTab] = useState<Tab>('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) {
      setRegError('As senhas não coincidem.');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    setRegLoading(true);
    try {
      const res = await api.register(regUsername.trim(), regPassword);
      const { token, user } = res.data;
      localStorage.setItem('sisdrone_jwt', token);
      localStorage.setItem('sisdrone_user', JSON.stringify(user));
      localStorage.setItem('sisdrone_mock_role', user.role);
      onLogin(user);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e?.response?.data?.error;
      setRegError(msg ?? 'Erro ao registrar. Tente outro nome de usuário.');
    } finally {
      setRegLoading(false);
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

        {/* Tab switcher */}
        <div className="flex border-b border-light/10 mb-4">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'login' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-light'}`}
            onClick={() => setTab('login')}
          >
            <LogIn size={14} className="inline mr-1" /> Entrar
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'register' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-light'}`}
            onClick={() => setTab('register')}
          >
            <UserPlus size={14} className="inline mr-1" /> Registrar
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
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
        ) : (
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label htmlFor="reg-username">Usuário</label>
              <input
                id="reg-username"
                type="text"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value)}
                className="glass-input"
                placeholder="meu_usuario"
                minLength={3}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Senha</label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                className="glass-input"
                placeholder="mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-confirm">Confirmar Senha</label>
              <input
                id="reg-confirm"
                type="password"
                value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)}
                className="glass-input"
                placeholder="repita a senha"
                required
              />
            </div>
            {regError && <p className="login-error" role="alert">{regError}</p>}
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={regLoading || !regUsername.trim() || !regPassword}
            >
              <UserPlus size={18} />
              {regLoading ? 'Registrando...' : 'Criar Conta'}
            </button>
          </form>
        )}

        {tab === 'login' && (
          <p className="login-hint">
            Usuários: admin, eng1, eng2 · Senha padrão: sisdrone123
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

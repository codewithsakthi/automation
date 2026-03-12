import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2 } from 'lucide-react';

const API_BASE = 'https://automation-0pd0.onrender.com';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password })
      });

      const tokenPayload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(tokenPayload.detail || 'Login failed');
      }

      localStorage.setItem('token', tokenPayload.access_token);

      const userResp = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
      });

      if (!userResp.ok) {
        throw new Error('Failed to load profile');
      }

      const userData = await userResp.json();
      if (userData.role === 'student' && /^\d{8}$/.test(password)) {
        localStorage.setItem('syncDob', password);
      }
      onLogin(userData);
      navigate(userData.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      localStorage.removeItem('token');
      setError(err.message || 'Invalid credentials or server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-panel animate-fade auth-card">
        <h2 className="gradient-text auth-title">Welcome Back</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Username / Roll Number</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                className="input-field"
                placeholder="258312"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="input-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? <Loader2 className="spinner" /> : 'Sign In'}
          </button>
          {error ? <p className="auth-error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
};

export default Login;

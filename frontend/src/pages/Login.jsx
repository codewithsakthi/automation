import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="glass-panel animate-fade" style={{ width: '400px', padding: '2.5rem' }}>
        <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Welcome Back</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label style={{ color: 'var(--text-muted)' }}>Username / Roll Number</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="248307"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="input-group">
            <label style={{ color: 'var(--text-muted)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="input-field"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} disabled={loading}>
            {loading ? <Loader2 className="spinner" /> : 'Sign In'}
          </button>
          {error ? <p style={{ color: '#fda4af', marginTop: '1rem', textAlign: 'center' }}>{error}</p> : null}
        </form>
      </div>
    </div>
  );
};

export default Login;

import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import MobileNav from './components/MobileNav';
import './index.css';

const getStoredUser = () => {
  const raw = localStorage.getItem('user');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

function App() {
  const [user, setUser] = useState(getStoredUser);
  const [activeAction, setActiveAction] = useState(() => window.location.hash.replace('#', '') || 'overview');

  const isAuthenticated = useMemo(() => Boolean(user && localStorage.getItem('token')), [user]);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const syncHash = () => {
      setActiveAction(window.location.hash.replace('#', '') || 'overview');
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);

    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const handleLogin = (nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const handleUserUpdate = (nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('syncDob');
    localStorage.removeItem('lastSyncMeta');
    localStorage.removeItem('lastSyncMessage');
    window.location.hash = '';
    setUser(null);
  };

  const handleMobileAction = (view) => {
    setActiveAction(view);
    window.location.hash = view;
    window.dispatchEvent(new CustomEvent(isAdmin ? 'admin-view-change' : 'student-view-change', { detail: view }));
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace /> : <Login onLogin={handleLogin} />} />
          <Route
            path="/dashboard"
            element={isAuthenticated && !isAdmin ? <Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to={isAuthenticated ? '/admin' : '/login'} replace />}
          />
          <Route
            path="/admin"
            element={isAuthenticated && isAdmin ? <AdminDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
          />
          <Route path="*" element={<Navigate to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/login'} replace />} />
        </Routes>
        {isAuthenticated && (
          <MobileNav
            role={user?.role}
            activeAction={activeAction}
            onAction={handleMobileAction}
            onLogout={handleLogout}
          />
        )}
      </div>
    </Router>
  );
}

export default App;

import React, { useMemo, useState } from 'react';
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

  const isAuthenticated = useMemo(() => Boolean(user && localStorage.getItem('token')), [user]);
  const isAdmin = user?.role === 'admin';

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
    setUser(null);
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
            activeAction={window.location.hash.split('#')[1] || 'overview'} 
            onAction={(view) => {
              if (isAdmin) {
                // Since AdminDashboard is a standalone page, we can use a simple event or hash
                window.location.hash = view;
                // Or better, since it's the same page, we can use a custom event
                window.dispatchEvent(new CustomEvent('admin-view-change', { detail: view }));
              }
            }} 
          />
        )}
      </div>
    </Router>
  );
}

export default App;

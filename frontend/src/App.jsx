import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MobileNav from './components/MobileNav';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 300000,
    },
  },
});

function App() {
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role?.name === 'admin';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm font-semibold text-muted-foreground">Loading workspace...</div>}>
            <Routes>
              <Route
                path="/login"
                element={isAuthenticated ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace /> : <Login />}
              />
              
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              
              <Route path="*" element={<Navigate to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/login'} replace />} />
            </Routes>
          </Suspense>
          
          {isAuthenticated && (
            <MobileNav
              role={user?.role?.name || user?.role}
              onLogout={handleLogout}
            />
          )}
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;


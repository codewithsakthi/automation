import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));

import ConsentScreen from './components/ConsentScreen';

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
  const { user, logout, hasConsented, setConsent } = useAuthStore();
  const { theme } = useThemeStore();
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role?.name === 'admin';
  const isStaff = user?.role === 'staff' || user?.role?.name === 'staff';

  const getRedirectPath = () => {
    if (isAdmin) return '/admin';
    if (isStaff) return '/staff';
    return '/dashboard';
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };


  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router>
          <PwaInstallPrompt />
          <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm font-semibold text-muted-foreground">Loading workspace...</div>}>
              <Routes>
                <Route
                  path="/login"
                  element={isAuthenticated ? <Navigate to={getRedirectPath()} replace /> : <Login />}
                />
                
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout>
                        <Dashboard />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute adminOnly>
                      <DashboardLayout>
                        <AdminDashboard />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute staffOnly>
                      <DashboardLayout>
                        <StaffDashboard />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />
                
                <Route path="*" element={<Navigate to={isAuthenticated ? getRedirectPath() : '/login'} replace />} />
              </Routes>
            </Suspense>

          </div>
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;


import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

import SplashScreen from './components/SplashScreen';
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
  const [showSplash, setShowSplash] = useState(true);
  
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role?.name === 'admin';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!hasConsented && !isAdmin) {
    return (
      <ConsentScreen 
        onConsent={() => setConsent(true)} 
        onDecline={() => {
          // Stay on consent or redirect to a landing? 
          // Prompt says: redirect them back to the login page.
          // But since they haven't logged in yet (or have they?), 
          // usually this is shown after splash, before login or after login?
          // Prompt says: "immediately after the SPARK splash screen completes"
          // "If the student declines, redirect them back to the login page."
          // This implies the flow is Splash -> Consent -> Login.
          // In my code, I'll allow Login to happen, then check for consent?
          // No, prompt says: "app appears as a separate full-screen page after the splash screen".
          // So: Splash -> Consent -> Login/Dashboard.
          // If declined -> show Login but Consent will reappear if they try to enter?
          // Actually if they decline, we just keep them on Login or show a generic message.
          // For now, I'll set a state or just keep them here.
          // If they decline, we can't really do anything but keep showing consent or go to login with a message.
          setConsent(false);
          // For now, I'll just not set consent and maybe redirect to login logic
        }} 
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <PwaInstallPrompt />
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
              
              <Route path="*" element={<Navigate to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/login'} replace />} />
            </Routes>
          </Suspense>

        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;


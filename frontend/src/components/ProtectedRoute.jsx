import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children, adminOnly = false, staffOnly = false }) => {
  const { user, token } = useAuthStore();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = user?.role?.name || user?.role || 'student';

  if (adminOnly && userRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (staffOnly && userRole !== 'staff') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

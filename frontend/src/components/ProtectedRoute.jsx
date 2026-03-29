import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getDefaultRouteForRole } from '../routes/config';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, token } = useAuthStore();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (user?.role?.name || user?.role || 'student').toLowerCase();

  // Check if route is restricted by role
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect unauthorized users to their designated home path
    return <Navigate to={getDefaultRouteForRole(userRole)} replace />;
  }

  return children;
};

export default ProtectedRoute;

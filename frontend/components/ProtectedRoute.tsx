import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { usePermission, type Permission } from '../utils/permissions';

interface ProtectedRouteProps {
  permission: Permission;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ permission, children }) => {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { can } = usePermission();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!can(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

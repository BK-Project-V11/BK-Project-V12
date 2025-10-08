import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  // Debug information
  console.log('RoleBasedRoute Debug:', {
    loading,
    user: user?.id,
    userEmail: user?.email,
    userMetadata: user?.user_metadata,
    userRole: user?.user_metadata?.role,
    allowedRoles,
    currentPath: location.pathname,
    rawUser: user,
  });

  // Additional debug for session data
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
    };
    checkSession();
  }, []);
  
  if (loading) {
    return <div>Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!user) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  // Get user role from metadata
  const userRole = user?.user_metadata?.role;
  
  // Special handling for testing
  if (process.env.NODE_ENV === 'development' && !userRole) {
    console.log('Development mode: allowing access without role check');
    return <>{children}</>;
  }

    // Special handling for testing
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: allowing access for testing');
    return <>{children}</>;
  }

  // If specific roles are provided, check if user's role is included
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    console.log(`Access denied: ${userRole} trying to access restricted route`);
    console.log('Required roles:', allowedRoles);
    console.log('User metadata:', user?.user_metadata);
    return <Navigate to="/pos" replace state={{ from: location }} />;
  }

  // Default role-based routing for routes without specific allowedRoles
  if (!allowedRoles) {
    const allowedRoutesByRole = {
      admin: ['*'], // Admin can access all routes
      manager: ['*'], // Manager can access all routes
      cashier: ['/pos', '/products', '/profile', '/settings'] // Cashier has limited access
    };

    const userAllowedRoutes = allowedRoutesByRole[userRole as keyof typeof allowedRoutesByRole] || [];
    const currentPath = location.pathname.toLowerCase();
    
    const isAllowedRoute = userAllowedRoutes.some(route => {
      if (route === '*') {
        return true;
      }
      return currentPath === route.toLowerCase() || 
             (currentPath !== '/' && currentPath.startsWith(route.toLowerCase() + '/'));
    });

    if (!isAllowedRoute) {
      console.log(`Route access denied: ${userRole} trying to access ${currentPath}`);
      console.log('Allowed routes:', userAllowedRoutes);
      return <Navigate to="/pos" replace state={{ from: location }} />;
    }
  }

  return <>{children}</>;
}
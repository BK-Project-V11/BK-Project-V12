import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { RoleBasedRoute } from './components/RoleBasedRoute';

// Pages
import Dashboard from './pages/Dashboard';
import Storage from './pages/Storage';
import Distribution from './pages/Distribution';
import POS from './pages/POS';
import KasirProducts from './pages/KasirProducts';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import EmailConfirmation from './pages/EmailConfirmation';
import NotFound from './pages/NotFound';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';

export const routes = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <NotFound />,
    children: [
      // Public routes
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <SignUp /> },
      { path: 'email-confirmation', element: <EmailConfirmation /> },
      
      // Protected routes
      { 
        path: '/', 
        element: <RoleBasedRoute><POS /></RoleBasedRoute> 
      },
      { 
        path: 'pos', 
        element: <RoleBasedRoute><POS /></RoleBasedRoute> 
      },
      { 
        path: 'profile', 
        element: <RoleBasedRoute><Profile /></RoleBasedRoute> 
      },
      { 
        path: 'settings', 
        element: <RoleBasedRoute><Settings /></RoleBasedRoute> 
      },
      
      // Admin only routes
      { 
        path: 'dashboard', 
        element: <RoleBasedRoute allowedRoles={['admin']}><Dashboard /></RoleBasedRoute> 
      },
      { 
        path: 'storage', 
        element: <RoleBasedRoute allowedRoles={['admin']}><Storage /></RoleBasedRoute> 
      },
      { 
        path: 'distribution', 
        element: <RoleBasedRoute allowedRoles={['admin']}><Distribution /></RoleBasedRoute> 
      },
      { 
        path: 'reports', 
        element: <RoleBasedRoute allowedRoles={['admin']}><Reports /></RoleBasedRoute> 
      },
      { 
        path: 'user-management', 
        element: <RoleBasedRoute allowedRoles={['admin']}><UserManagement /></RoleBasedRoute> 
      },
      
      // Cashier only routes
      { 
        path: 'products', 
        element: <RoleBasedRoute allowedRoles={['cashier']}><KasirProducts /></RoleBasedRoute> 
      },
      
      // Fallback for unknown routes
      { 
        path: '*', 
        element: <NotFound /> 
      }
    ]
  }
];

export const router = createBrowserRouter(routes);
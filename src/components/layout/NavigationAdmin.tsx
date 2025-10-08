import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Package,
  Store,
  ShoppingCart, 
  BarChart3,
  Settings,
  LogOut,
  User,
  Users
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const NavigationAdmin = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        description: "Berhasil keluar dari sistem",
      });
      navigate('/login');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal keluar dari sistem",
      });
    }
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      path: '/storage',
      label: 'Storage',
      icon: Store
    },
    {
      path: '/distribution',
      label: 'Distribution',
      icon: Package
    },
    {
      path: '/pos',
      label: 'POS',
      icon: ShoppingCart
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: BarChart3
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: Settings
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: User
    },
    {
      path: '/user-management',
      label: 'Manajemen User',
      icon: Users
    }
  ];

  return (
    <div className="flex flex-col space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.path} to={item.path}>
            <Button
              variant={location.pathname === item.path ? 'default' : 'ghost'}
              className="flex items-center space-x-2 w-full justify-start"
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}
      <Button
        variant="ghost"
        onClick={handleLogout}
        className="flex items-center space-x-2 text-red-500 hover:text-red-700 hover:bg-red-100 w-full justify-start"
      >
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </Button>
    </div>
  );
};

export default NavigationAdmin;
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Store, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import NavigationCashier from './NavigationCashier';
import NavigationAdmin from './NavigationAdmin';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Navigation = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Check user role
  const isCashier = user?.user_metadata?.role === 'cashier';
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Determine which navigation component to show based on role
  const renderNavigation = () => {
    if (isCashier) {
      return <NavigationCashier />;
    }
    if (isAdmin) {
      return <NavigationAdmin />;
    }
    return <NavigationCashier />; // Default to cashier view if role is undefined
  };

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-gradient-to-br from-primary to-primary/80 p-2 rounded-lg">
                <Store className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">BK POS</span>
            </Link>
          </div>

          {isMobile ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                    Navigasi BK POS
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  {renderNavigation()}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <div className="hidden lg:flex items-center">
              {renderNavigation()}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
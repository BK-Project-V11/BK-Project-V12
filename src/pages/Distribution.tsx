import { useState, useEffect } from 'react';
import { usePOS, Product } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  Send,
  History,
  Search,
  AlertTriangle,
  Package,
  Check,
  Clock,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

interface DistributionFormData {
  productId: string;
  quantity: number;
  cashierId: string;
}

const Distribution = () => {
  const { user, role } = useAuth();
  const { products } = usePOS();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cashiers, setCashiers] = useState<Array<{ id: string; email: string }>>([]);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCashiers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('role', 'cashier');

      if (error) {
        toast({
          title: 'Error',
          description: 'Gagal memuat data kasir',
          variant: 'destructive'
        });
        return;
      }

      setCashiers(data || []);
    };

    const loadDistributions = async () => {
      try {
        setLoading(true);
        
        // Verify authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        // Get distributions with product details
        const { data: distributionData, error: distributionError } = await supabase
          .from('product_distributions')
          .select(`
            *,
            products (
              id,
              name,
              sku,
              storage_stock,
              distribution_stock
            )
          `)
          .order('created_at', { ascending: false });

        if (distributionError) {
          console.error('Distribution query error:', distributionError);
          throw distributionError;
        }

        if (!distributionData) {
          setDistributions([]);
          return;
        }

        // Get all unique user IDs
        const allUserIds = [...new Set([
          ...distributionData.map(d => d.cashier_id),
          ...distributionData.map(d => d.distributed_by)
        ])].filter(Boolean);

        // Get user details
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, raw_user_meta_data')
          .in('id', allUserIds);

        if (usersError) {
          console.error('Users query error:', usersError);
          throw usersError;
        }

        // Create user lookup map
        const usersMap = new Map(
          (usersData || []).map(user => [user.id, {
            id: user.id,
            email: user.email,
            role: user.raw_user_meta_data?.role
          }])
        );

        // Combine all data
        const enrichedData = distributionData.map(dist => ({
          ...dist,
          product: dist.products,
          cashier: usersMap.get(dist.cashier_id),
          distributor: usersMap.get(dist.distributed_by)
        }));

        if (error) {
          console.error('Distribution query error:', error);
          throw error;
        }

        // Combine the data with already fetched user data
        setDistributions(enrichedData);

        setDistributions(enrichedData);
      } catch (err) {
        console.error('Error in loadDistributions:', err);
        toast({
          title: 'Error',
          description: 'Terjadi kesalahan saat memuat data',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadCashiers();
    loadDistributions();
  }, []);

  const handleDistribute = async (formData: DistributionFormData) => {
    try {
      const { data, error } = await supabase
        .from('product_distributions')
        .insert({
          product_id: formData.productId,
          quantity: formData.quantity,
          cashier_id: formData.cashierId,
          distributed_by: user?.id,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Distribusi Berhasil',
        description: 'Produk telah didistribusikan ke kasir'
      });

      // Reload distributions
      const { data: newData } = await supabase
        .from('product_distributions')
        .select(`
          *,
          product:products(name, sku),
          cashier:cashier_id(email),
          distributor:distributed_by(email)
        `)
        .order('created_at', { ascending: false });

      setDistributions(newData || []);

    } catch (error: any) {
      toast({
        title: 'Distribusi Gagal',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const filteredDistributions = distributions.filter(dist => {
    const matchesSearch = 
      dist.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dist.product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dist.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-600">Pending</Badge>;
      case 'distributed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600">Distributed</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-600">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Distribution Management</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Cari distribusi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="distributed">Distributed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredDistributions.map(distribution => (
          <Card key={distribution.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{distribution.product.name}</CardTitle>
                  <p className="text-sm text-gray-500">SKU: {distribution.product.sku}</p>
                </div>
                {getStatusBadge(distribution.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Quantity:</Label>
                  <p className="font-semibold">{distribution.quantity}</p>
                </div>
                <div>
                  <Label>Cashier:</Label>
                  <p className="font-semibold">{distribution.cashier.email}</p>
                </div>
                <div>
                  <Label>Distributed By:</Label>
                  <p className="font-semibold">{distribution.distributor.email}</p>
                </div>
                <div>
                  <Label>Date:</Label>
                  <p className="font-semibold">
                    {new Date(distribution.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              {distribution.status === 'pending' && role === 'admin' && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="text-red-600"
                    onClick={() => {
                      // Handle cancel distribution
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // Handle confirm distribution
                    }}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirm Distribution
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {role === 'admin' && (
        <Dialog>
          <DialogTrigger asChild>
            <Button className="fixed bottom-6 right-6">
              <Send className="w-4 h-4 mr-2" />
              New Distribution
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Distribution</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleDistribute({
                productId: formData.get('productId') as string,
                quantity: Number(formData.get('quantity')),
                cashierId: formData.get('cashierId') as string
              });
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="productId">Product</Label>
                  <Select name="productId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} (Stock: {product.storage_stock})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    type="number"
                    name="quantity"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cashierId">Cashier</Label>
                  <Select name="cashierId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select cashier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {cashiers.map(cashier => (
                          <SelectItem key={cashier.id} value={cashier.id}>
                            {cashier.email}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="submit">
                  <Send className="w-4 h-4 mr-2" />
                  Distribute
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Distribution;
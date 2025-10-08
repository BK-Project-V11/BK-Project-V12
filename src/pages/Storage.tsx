import { useState, useEffect } from 'react';
import { usePOS, Product } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  Minus,
  Plus,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  Search,
  AlertTriangle,
  BoxIcon,
  Send
} from 'lucide-react';
import { StockAdjustmentDialog } from '@/components/StockAdjustmentDialog';
import { StockHistoryDialog } from '@/components/StockHistoryDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconWrapper } from '@/components/ui/IconWrapper';
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';

const Storage = () => {
  const { user, role } = useAuth();
  const { products, updateProduct } = usePOS();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
          description: 'Silakan login kembali',
          variant: 'destructive'
        });
        return;
      }

      if (products !== undefined) {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [products]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Memuat data produk...</p>
        </div>
      </div>
    );
  }

  // No products state
  if (!products || products.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold">Tidak ada produk tersedia</p>
          <p className="text-sm text-gray-600">Silakan tambahkan produk terlebih dahulu</p>
        </div>
      </div>
    );
  }

  if (isLoading || !products) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const filteredProducts = (products || []).filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesStock = stockFilter === 'all' ||
                        (stockFilter === 'low' && product.storage_stock < 10) ||
                        (stockFilter === 'out' && product.storage_stock === 0) ||
                        (stockFilter === 'returned' && product.returned_stock > 0) ||
                        (stockFilter === 'rejected' && product.rejected_stock > 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const categories = [...new Set(products.map(p => p.category))];

  const handleAdjustment = async (productId: string, adjustmentType: string, quantity: number, condition: string, notes: string) => {
    try {
      const { data, error } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          adjustment_type: adjustmentType,
          quantity,
          condition,
          notes,
          source_location: adjustmentType === 'production' ? 'production' : 'storage',
          target_location: 'storage',
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: 'Stok Berhasil Disesuaikan',
        description: `${quantity} unit telah ${adjustmentType === 'production' ? 'ditambahkan ke' : 'dikurangi dari'} storage`,
      });

    } catch (error: any) {
      toast({
        title: 'Gagal Menyesuaikan Stok',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Storage Management</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter Stok" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua Stok</SelectItem>
                <SelectItem value="low">Stok Rendah</SelectItem>
                <SelectItem value="out">Habis</SelectItem>
                <SelectItem value="returned">Barang Retur</SelectItem>
                <SelectItem value="rejected">Barang Reject</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => (
          <Card key={product.id} className={cn(
            "relative",
            product.storage_stock < 10 && "border-yellow-500",
            product.storage_stock === 0 && "border-red-500"
          )}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                </div>
                <Badge>{product.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Storage Stock:</Label>
                  <span className={cn(
                    "font-bold",
                    product.storage_stock < 10 ? "text-yellow-600" : "text-green-600",
                    product.storage_stock === 0 && "text-red-600"
                  )}>
                    {product.storage_stock}
                  </span>
                </div>
                {product.returned_stock > 0 && (
                  <div className="flex justify-between items-center">
                    <Label>Returned:</Label>
                    <span className="text-orange-600 font-bold">{product.returned_stock}</span>
                  </div>
                )}
                {product.rejected_stock > 0 && (
                  <div className="flex justify-between items-center">
                    <Label>Rejected:</Label>
                    <span className="text-red-600 font-bold">{product.rejected_stock}</span>
                  </div>
                )}
                
                <div className="flex justify-between gap-2 mt-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Stock
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Production Stock</DialogTitle>
                      </DialogHeader>
                      <StockAdjustmentDialog
                        product={product}
                        onSubmit={(quantity, condition, notes) => 
                          handleAdjustment(product.id, 'production', quantity, condition, notes)
                        }
                      />
                    </DialogContent>
                  </Dialog>

                  <StockHistoryDialog product={product} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Storage;
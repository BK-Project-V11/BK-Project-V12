import { useState, useEffect } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  RefreshCcw,
  XOctagon,
  Package,
  Search,
  AlertTriangle
} from 'lucide-react';
import { ReturnDialog } from '@/components/ReturnDialog';
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
import { Textarea } from '@/components/ui/textarea';

interface ReturnRejectFormData {
  quantity: number;
  reason: string;
  condition: string;
  notes: string;
}

const KasirProducts = () => {
  const { user } = useAuth();
  const { products } = usePOS();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory && product.distribution_stock > 0;
  });

  const categories = [...new Set(products.map(p => p.category))];

  const handleReturnReject = async (
    productId: string, 
    actionType: 'return' | 'reject',
    formData: ReturnRejectFormData
  ) => {
    try {
      const { data, error } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          adjustment_type: actionType,
          quantity: formData.quantity,
          condition: formData.condition,
          reason: formData.reason,
          notes: formData.notes,
          source_location: 'cashier',
          target_location: 'storage',
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: `Produk telah di${actionType === 'return' ? 'retur' : 'reject'} ke storage`,
      });

    } catch (error: any) {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => (
          <Card key={product.id}>
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
                  <Label>Available Stock:</Label>
                  <span className={cn(
                    "font-bold",
                    product.distribution_stock < 10 ? "text-yellow-600" : "text-green-600",
                    product.distribution_stock === 0 && "text-red-600"
                  )}>
                    {product.distribution_stock}
                  </span>
                </div>

                <div className="flex justify-between gap-2 mt-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Return
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Return Product</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleReturnReject(product.id, 'return', {
                          quantity: Number(formData.get('quantity')),
                          reason: formData.get('reason') as string,
                          condition: formData.get('condition') as string,
                          notes: formData.get('notes') as string
                        });
                      }}>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input
                              type="number"
                              name="quantity"
                              min="1"
                              max={product.distribution_stock}
                              required
                            />
                          </div>

                          <div>
                            <Label htmlFor="reason">Reason</Label>
                            <Select name="reason" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="damaged">Damaged</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                  <SelectItem value="quality_issue">Quality Issue</SelectItem>
                                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="condition">Condition</Label>
                            <Select name="condition" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="good">Good</SelectItem>
                                  <SelectItem value="damaged">Damaged</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea name="notes" placeholder="Additional notes..." />
                          </div>
                        </div>

                        <DialogFooter className="mt-6">
                          <Button type="submit">
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Return to Storage
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <XOctagon className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject Product</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to reject this product? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleReturnReject(product.id, 'reject', {
                          quantity: Number(formData.get('quantity')),
                          reason: formData.get('reason') as string,
                          condition: 'rejected',
                          notes: formData.get('notes') as string
                        });
                      }}>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input
                              type="number"
                              name="quantity"
                              min="1"
                              max={product.distribution_stock}
                              required
                            />
                          </div>

                          <div>
                            <Label htmlFor="reason">Reason</Label>
                            <Select name="reason" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="quality_issue">Quality Issue</SelectItem>
                                  <SelectItem value="contaminated">Contaminated</SelectItem>
                                  <SelectItem value="safety_concern">Safety Concern</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea name="notes" placeholder="Additional notes..." required />
                          </div>
                        </div>

                        <AlertDialogFooter className="mt-6">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction type="submit">
                            <XOctagon className="w-4 h-4 mr-2" />
                            Confirm Reject
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </form>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default KasirProducts;
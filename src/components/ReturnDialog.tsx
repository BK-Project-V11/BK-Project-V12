import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createStockAdjustment } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  quantity: number;
}

interface ReturnDialogProps {
  product: Product;
  onSuccess: () => void;
  type: 'return' | 'reject';
}

export function ReturnDialog({ product, onSuccess, type }: ReturnDialogProps) {
  const [formData, setFormData] = React.useState({
    quantity: 1,
    condition: type === 'reject' ? 'rejected' : 'good',
    notes: '',
  });
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createStockAdjustment({
        product_id: product.id,
        adjustment_type: type,
        quantity: formData.quantity,
        source_location: 'cashier',
        target_location: 'storage',
        condition: formData.condition as any,
        notes: formData.notes,
      });

      toast({
        title: "Sukses",
        description: `Produk berhasil di${type === 'return' ? 'kembalikan' : 'tolak'}`,
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={type === 'reject' ? 'destructive' : 'secondary'}>
          {type === 'return' ? 'Return' : 'Reject'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'return' ? 'Kembalikan Produk' : 'Tolak Produk'} {product.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Jumlah</Label>
            <Input
              type="number"
              min={1}
              max={product.quantity}
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
            />
          </div>

          {type === 'return' && (
            <div>
              <Label>Kondisi</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData({ ...formData, condition: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Baik</SelectItem>
                  <SelectItem value="damaged">Rusak</SelectItem>
                  <SelectItem value="expired">Kadaluarsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Alasan</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={`Alasan ${type === 'return' ? 'pengembalian' : 'penolakan'}`}
              required
            />
          </div>

          <Button type="submit" className="w-full">
            {type === 'return' ? 'Kembalikan' : 'Tolak'} Produk
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
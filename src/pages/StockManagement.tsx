import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { createStockAdjustment, getStockAdjustments } from '@/lib/api';
import type { StockAdjustmentType, LocationType, ConditionType } from '@/lib/api';

export default function StockManagement() {
  const [adjustments, setAdjustments] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAdjustments();
  }, []);

  async function loadAdjustments() {
    try {
      const data = await getStockAdjustments();
      setAdjustments(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data penyesuaian stok",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Stok</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Tambah Penyesuaian Stok</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Penyesuaian Stok</DialogTitle>
            </DialogHeader>
            <StockAdjustmentForm onSuccess={() => {
              setIsOpen(false);
              loadAdjustments();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Dari</TableHead>
              <TableHead>Ke</TableHead>
              <TableHead>Kondisi</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((adj) => (
              <TableRow key={adj.id}>
                <TableCell>{new Date(adj.created_at).toLocaleString()}</TableCell>
                <TableCell>{adj.product?.name}</TableCell>
                <TableCell>{adj.adjustment_type}</TableCell>
                <TableCell>{adj.quantity}</TableCell>
                <TableCell>{adj.source_location}</TableCell>
                <TableCell>{adj.target_location}</TableCell>
                <TableCell>{adj.condition}</TableCell>
                <TableCell>{adj.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StockAdjustmentForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    product_id: '',
    adjustment_type: 'production',
    quantity: 0,
    source_location: 'production',
    target_location: 'storage',
    condition: 'good',
    notes: '',
  });
  const { toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await createStockAdjustment(formData);
      toast({
        title: "Sukses",
        description: "Penyesuaian stok berhasil ditambahkan",
      });
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Tipe Penyesuaian
        </label>
        <Select
          value={formData.adjustment_type}
          onValueChange={(value) => setFormData({ ...formData, adjustment_type: value as StockAdjustmentType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="production">Produksi</SelectItem>
            <SelectItem value="distribution">Distribusi</SelectItem>
            <SelectItem value="return">Return</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="disposal">Disposal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Jumlah
        </label>
        <Input
          type="number"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
          min={1}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Lokasi Asal
        </label>
        <Select
          value={formData.source_location}
          onValueChange={(value) => setFormData({ ...formData, source_location: value as LocationType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="production">Produksi</SelectItem>
            <SelectItem value="storage">Storage</SelectItem>
            <SelectItem value="cashier">Kasir</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Lokasi Tujuan
        </label>
        <Select
          value={formData.target_location}
          onValueChange={(value) => setFormData({ ...formData, target_location: value as LocationType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="storage">Storage</SelectItem>
            <SelectItem value="cashier">Kasir</SelectItem>
            <SelectItem value="disposal">Disposal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Kondisi
        </label>
        <Select
          value={formData.condition}
          onValueChange={(value) => setFormData({ ...formData, condition: value as ConditionType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="good">Baik</SelectItem>
            <SelectItem value="damaged">Rusak</SelectItem>
            <SelectItem value="expired">Kadaluarsa</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Catatan
        </label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Tambahkan catatan (opsional)"
        />
      </div>

      <Button type="submit" className="w-full">
        Simpan
      </Button>
    </form>
  );
}

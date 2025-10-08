import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Product } from "@/contexts/POSContext";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface StockHistory {
  id: string;
  product_id: string;
  adjustment_type: "increase" | "decrease";
  quantity: number;
  reason: string;
  notes: string;
  condition: string;
  created_at: string;
}

interface StockHistoryDialogProps {
  product: Product;
}

export function StockHistoryDialog({ product }: StockHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_adjustments')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Gagal mengambil histori stok",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Histori Stok</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Histori Stok</DialogTitle>
          <DialogDescription>
            Riwayat perubahan stok untuk {product.name}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-4">Memuat data...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Kondisi</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {item.adjustment_type === "increase" ? "+" : "-"}
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell>{item.condition || "-"}</TableCell>
                    <TableCell>{item.notes || "-"}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Tidak ada data histori
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

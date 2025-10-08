import { useState } from 'react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Product } from "@/contexts/POSContext";

const stockAdjustmentSchema = z.object({
  adjustment_type: z.enum(["increase", "decrease"]),
  reason: z.string().min(1, "Alasan harus diisi"),
  quantity: z.string().min(1, "Jumlah harus diisi"),
  notes: z.string().optional(),
  condition: z.string().optional(),
});

const increaseReasons = [
  "stock_opname_more", // Stok opname lebih dari pencatatan
  "additional_production", // Produksi tambahan
  "return_from_cashier", // Pengembalian dari kasir
  "other_increase", // Lainnya (penambahan)
] as const;

const decreaseReasons = [
  "stock_opname_less", // Stok opname kurang dari pencatatan
  "damaged", // Rusak
  "expired", // Kadaluarsa
  "quality_issue", // Masalah kualitas
  "other_decrease", // Lainnya (pengurangan)
] as const;

const reasonLabels: Record<string, string> = {
  stock_opname_more: "Stok Opname (Lebih)",
  additional_production: "Produksi Tambahan",
  return_from_cashier: "Pengembalian dari Kasir",
  other_increase: "Lainnya (Penambahan)",
  stock_opname_less: "Stok Opname (Kurang)",
  damaged: "Rusak",
  expired: "Kadaluarsa",
  quality_issue: "Masalah Kualitas",
  other_decrease: "Lainnya (Pengurangan)",
};

interface StockAdjustmentDialogProps {
  product: Product;
  onSuccess?: () => void;
}

export function StockAdjustmentDialog({ product, onSuccess }: StockAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof stockAdjustmentSchema>>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      adjustment_type: "increase",
      reason: "",
      quantity: "",
      notes: "",
      condition: "good",
    },
  });

  const adjustmentType = form.watch("adjustment_type");
  const availableReasons = adjustmentType === "increase" ? increaseReasons : decreaseReasons;

  const onSubmit = async (values: z.infer<typeof stockAdjustmentSchema>) => {
    try {
      setIsSubmitting(true);
      const quantity = parseInt(values.quantity);
      
      if (values.adjustment_type === "decrease" && quantity > product.stock) {
        toast({
          title: "Error",
          description: "Jumlah pengurangan tidak boleh melebihi stok yang ada",
          variant: "destructive",
        });
        return;
      }

      // Catat histori penyesuaian
      const { error: historyError } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: product.id,
          adjustment_type: values.adjustment_type,
          quantity: quantity,
          reason: values.reason,
          notes: values.notes,
          condition: values.condition,
        });

      if (historyError) throw historyError;

      toast({
        title: "Sukses",
        description: "Penyesuaian stok berhasil disimpan",
      });

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan penyesuaian stok",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Sesuaikan Stok</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok</DialogTitle>
          <DialogDescription>
            Sesuaikan stok produk {product.name}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="adjustment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis Penyesuaian</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis penyesuaian" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="increase">Penambahan</SelectItem>
                      <SelectItem value="decrease">Pengurangan</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alasan</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih alasan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reasonLabels[reason]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Masukkan jumlah"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {adjustmentType === "decrease" && (
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kondisi</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kondisi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="good">Baik</SelectItem>
                        <SelectItem value="damaged">Rusak</SelectItem>
                        <SelectItem value="expired">Kadaluarsa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tambahan keterangan..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

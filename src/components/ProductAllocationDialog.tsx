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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const productAllocationSchema = z.object({
  name: z.string().min(1, "Nama produk harus diisi"),
  sku: z.string().min(1, "SKU harus diisi"),
  description: z.string().optional(),
  category: z.string().min(1, "Kategori harus diisi"),
  price: z.string().min(1, "Harga harus diisi"),
  initialStock: z.string().min(1, "Stok awal harus diisi"),
  cashierId: z.string().min(1, "Kasir harus dipilih"),
  quantity: z.string().min(1, "Jumlah alokasi harus diisi"),
});

type ProductAllocationValues = z.infer<typeof productAllocationSchema>;

interface ProductAllocationDialogProps {
  onSuccess?: () => void;
  cashiers: { id: string; name: string }[];
}

export function ProductAllocationDialog({ onSuccess, cashiers }: ProductAllocationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProductAllocationValues>({
    resolver: zodResolver(productAllocationSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      category: "",
      price: "",
      initialStock: "",
      cashierId: "",
      quantity: "",
    },
  });

  const onSubmit = async (values: ProductAllocationValues) => {
    try {
      setIsSubmitting(true);

      // 1. Create product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          name: values.name,
          sku: values.sku,
          description: values.description,
          category: values.category,
          price: parseFloat(values.price),
          stock: parseInt(values.initialStock),
          total_produced: parseInt(values.initialStock),
        })
        .select()
        .single();

      if (productError) throw productError;

      // 2. Create production batch
      const { error: batchError } = await supabase
        .from('production_batches')
        .insert({
          product_id: productData.id,
          batch_number: `INIT-${values.sku}`,
          quantity: parseInt(values.initialStock),
          notes: 'Initial production batch',
        });

      if (batchError) throw batchError;

      // 3. Create allocation to cashier if quantity > 0
      if (parseInt(values.quantity) > 0) {
        const { error: allocationError } = await supabase
          .from('product_allocations')
          .insert({
            product_id: productData.id,
            cashier_id: values.cashierId,
            quantity: parseInt(values.quantity),
            notes: 'Initial allocation',
          });

        if (allocationError) throw allocationError;
      }

      toast({
        title: "Sukses",
        description: "Produk berhasil ditambahkan dan dialokasikan",
      });

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Gagal menambahkan produk. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Tambah Produk Baru</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tambah Produk & Alokasi</DialogTitle>
          <DialogDescription>
            Tambahkan produk baru dan alokasikan ke kasir
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Produk</FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan nama produk" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="Masukkan SKU" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan kategori produk"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Masukkan deskripsi produk" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Harga</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Masukkan harga" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="initialStock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stok Awal</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Masukkan stok awal" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cashierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alokasi ke Kasir</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kasir" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cashiers.map((cashier) => (
                        <SelectItem key={cashier.id} value={cashier.id}>
                          {cashier.name}
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
                  <FormLabel>Jumlah Alokasi</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Masukkan jumlah alokasi" 
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
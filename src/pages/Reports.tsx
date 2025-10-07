import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const Reports = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [sales, setSales] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!session?.access_token) {
      navigate('/login', { replace: true });
      return;
    }

    fetchCashiers();
    fetchSales();
  }, [session, navigate]);

  const fetchCashiers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name')
        .order('full_name', { ascending: true });

      if (error) throw error;

      setCashiers(data.map(user => ({
        id: user.id,
        name: user.full_name || user.username
      })));
    } catch (error) {
      console.error('Error fetching cashiers:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data kasir',
        variant: 'destructive',
      });
    }
  };

  const fetchSales = async () => {
    try {
      setIsLoading(true);

      let query = supabase
        .from('sales')
        .select(`
          id,
          created_at,
          subtotal,
          tax_amount,
          total,
          payment_method,
          cashier:users!cashier_id (
            id,
            username,
            full_name
          ),
          sale_items (
            id,
            product_id,
            quantity,
            price_at_time,
            product:products (
              id,
              name,
              sku
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedCashier !== 'all') {
        query = query.eq('cashier_id', selectedCashier);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mengambil data penjualan',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchSales();
    }
  }, [selectedCashier]);

  // Calculate summary statistics
  const calculateStats = () => {
    return sales.reduce((acc, sale) => ({
      totalRevenue: acc.totalRevenue + Number(sale.total),
      totalTransactions: acc.totalTransactions + 1,
      totalItems: acc.totalItems + (sale.sale_items || []).reduce((sum, item) => sum + Number(item.quantity), 0),
    }), {
      totalRevenue: 0,
      totalTransactions: 0,
      totalItems: 0,
    });
  };

  const stats = calculateStats();

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Generate CSV
  const generateCSV = () => {
    if (sales.length === 0) return;

    // Add BOM for Excel to properly detect UTF-8
    const BOM = '\uFEFF';
    
    // Format currency without currency symbol for Excel
    const formatExcelCurrency = (amount) => {
      return Number(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    // Prepare header rows
    const headerRows = [
      [`Laporan Penjualan - ${selectedCashier === 'all' ? 'Semua Kasir' : cashiers.find(c => c.id === selectedCashier)?.name || 'Unknown'}`],
      [`Periode: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`],
      [], // Empty row for spacing
    ];

    // Main data header
    const dataHeader = [
      ['No', 'Tanggal Transaksi', 'Waktu', 'Kasir', 'Total Transaksi', 'Metode Pembayaran', 'Jumlah Item', 'Detail Item']
    ];

    // Prepare detailed rows
    const detailRows = sales.map((sale, index) => {
      const date = new Date(sale.created_at);
      const items = sale.sale_items || [];
      const itemDetails = items.map(item => 
        `${item.product?.name || 'Unknown'} (${item.quantity}x @${formatExcelCurrency(item.price_at_time)})`
      ).join('; ');

      return [
        (index + 1).toString(),
        date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
        date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        sale.cashier?.full_name || sale.cashier?.username,
        formatExcelCurrency(sale.total),
        sale.payment_method,
        items.reduce((sum, item) => sum + Number(item.quantity), 0),
        itemDetails
      ];
    });

    // Summary section
    const summaryRows = [
      [], // Empty row for spacing
      ['Ringkasan:'],
      ['Total Pendapatan', formatExcelCurrency(stats.totalRevenue)],
      ['Total Transaksi', stats.totalTransactions],
      ['Total Item Terjual', stats.totalItems],
    ];

    // Combine all rows
    const allRows = [
      ...headerRows,
      ...dataHeader,
      ...detailRows,
      ...summaryRows
    ];

    // Convert to CSV content
    const csvContent = BOM + allRows.map(row => 
      row.map(cell => 
        // Escape cells containing commas or quotes
        /[,"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(',')
    ).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const cashierName = selectedCashier === 'all' ? 'semua-kasir' : 
      cashiers.find(c => c.id === selectedCashier)?.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
    link.download = `laporan-penjualan_${cashierName}_${dateStr}.csv`;
    link.click(); // Menambahkan ini untuk memulai download
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
        <div className="flex items-center gap-4">
          <Select
            value={selectedCashier}
            onValueChange={setSelectedCashier}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pilih Kasir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kasir</SelectItem>
              {cashiers.map((cashier) => (
                <SelectItem key={cashier.id} value={cashier.id}>
                  {cashier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generateCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pendapatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Item Terjual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Metode Pembayaran</TableHead>
                <TableHead>Jumlah Item</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Tidak ada data penjualan
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {new Date(sale.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>{sale.cashier?.full_name || sale.cashier?.username}</TableCell>
                    <TableCell>{formatCurrency(sale.total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {sale.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(sale.sale_items || []).reduce((sum, item) => sum + Number(item.quantity), 0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
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
import { Download, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { BarChart, Card as TremorCard, Title } from '@tremor/react';

const Reports = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [sales, setSales] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999))
  });
  
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

      // Add date range filter
      query = query.gte('created_at', dateRange.from.toISOString())
                   .lte('created_at', dateRange.to.toISOString());

      // Add cashier filter if selected
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
  }, [selectedCashier, dateRange]);

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

  // Calculate cashier performance metrics
  const calculateCashierMetrics = () => {
    const metrics = {};
    
    // Initialize metrics for each cashier
    cashiers.forEach(cashier => {
      metrics[cashier.id] = {
        name: cashier.name,
        totalSales: 0,
        totalTransactions: 0,
        totalItems: 0,
        averageTransaction: 0,
        performance: 0
      };
    });

    // Calculate metrics
    sales.forEach(sale => {
      if (sale.cashier?.id) {
        const cashierId = sale.cashier.id;
        if (metrics[cashierId]) {
          metrics[cashierId].totalSales += Number(sale.total);
          metrics[cashierId].totalTransactions += 1;
          metrics[cashierId].totalItems += (sale.sale_items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
        }
      }
    });

    // Calculate averages and format data for charts
    return Object.values(metrics).map(m => ({
      ...m,
      averageTransaction: m.totalTransactions > 0 ? m.totalSales / m.totalTransactions : 0,
      performance: m.totalTransactions > 0 ? (m.totalSales / m.totalTransactions) * m.totalItems : 0
    }));
  };

  const cashierMetrics = calculateCashierMetrics();

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
    
    // Format currency untuk Excel (tanpa simbol mata uang)
    const formatExcelNumber = (amount) => {
      return Number(amount).toLocaleString('id-ID');
    };

    // Header laporan
    const headerRows = [
      [`LAPORAN PENJUALAN ${selectedCashier === 'all' ? 'SEMUA KASIR' : cashiers.find(c => c.id === selectedCashier)?.name?.toUpperCase()}`],
      [`Periode: ${format(dateRange.from, 'dd MMMM yyyy', { locale: id })} - ${format(dateRange.to, 'dd MMMM yyyy', { locale: id })}`],
      [], // Baris kosong
    ];

    // Data transaksi
    const transactionHeaders = [
      ['No.', 'Tanggal', 'Waktu', 'Nama Kasir', 'Total Transaksi', 'Metode Pembayaran', 'Jumlah Item', 'Detail Item']
    ];

    // Detail transaksi
    const transactionRows = sales.map((sale, index) => {
      const date = new Date(sale.created_at);
      const items = sale.sale_items || [];
      const itemDetails = items.map(item => 
        `${item.product?.name || 'Unknown'} (${item.quantity}x @${formatExcelNumber(item.price_at_time)})`
      ).join('; ');

      return [
        (index + 1).toString(),
        date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
        date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        sale.cashier?.full_name || sale.cashier?.username,
        formatExcelNumber(sale.total),
        sale.payment_method,
        items.reduce((sum, item) => sum + Number(item.quantity), 0),
        itemDetails
      ];
    });

    // Ringkasan per kasir
    const cashierSummaryHeaders = [
      [],
      ['RINGKASAN PER KASIR'],
      ['Nama Kasir', 'Total Penjualan', 'Jumlah Transaksi', 'Total Item', 'Rata-rata Transaksi']
    ];

    const cashierSummaryRows = cashierMetrics.map(metric => [
      metric.name,
      formatExcelNumber(metric.totalSales),
      metric.totalTransactions,
      metric.totalItems,
      formatExcelNumber(metric.averageTransaction)
    ]);

    // Ringkasan total
    const summaryRows = [
      [],
      ['RINGKASAN TOTAL'],
      ['Total Pendapatan:', formatExcelNumber(stats.totalRevenue)],
      ['Total Transaksi:', stats.totalTransactions],
      ['Total Item Terjual:', stats.totalItems],
      ['Rata-rata Nilai Transaksi:', formatExcelNumber(stats.totalRevenue / (stats.totalTransactions || 1))]
    ];

    // Gabungkan semua bagian
    const allRows = [
      ...headerRows,
      ...transactionHeaders,
      ...transactionRows,
      ...cashierSummaryHeaders,
      ...cashierSummaryRows,
      ...summaryRows
    ];

    // Convert ke CSV dengan proper escaping
    const csvContent = BOM + allRows.map(row => 
      row.map(cell => {
        // Handle cells with commas, quotes, or newlines
        if (cell === null || cell === undefined) return '';
        const cellStr = cell.toString();
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    // Buat dan download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = `${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}`;
    const cashierName = selectedCashier === 'all' ? 'semua-kasir' : 
      cashiers.find(c => c.id === selectedCashier)?.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
    link.download = `laporan-penjualan_${cashierName}_${dateStr}.csv`;
    link.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
        <div className="flex items-center gap-4">
          <DateRangePicker
            value={dateRange}
            onValueChange={setDateRange}
          />
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

      <Card>
        <CardHeader>
          <CardTitle>Kinerja Kasir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TremorCard>
              <Title>Total Penjualan per Kasir</Title>
              <BarChart
                className="mt-4"
                data={cashierMetrics}
                index="name"
                categories={["totalSales"]}
                colors={["blue"]}
                valueFormatter={value => formatCurrency(value)}
              />
            </TremorCard>

            <TremorCard>
              <Title>Jumlah Transaksi per Kasir</Title>
              <BarChart
                className="mt-4"
                data={cashierMetrics}
                index="name"
                categories={["totalTransactions"]}
                colors={["green"]}
              />
            </TremorCard>

            <TremorCard>
              <Title>Total Item Terjual per Kasir</Title>
              <BarChart
                className="mt-4"
                data={cashierMetrics}
                index="name"
                categories={["totalItems"]}
                colors={["orange"]}
              />
            </TremorCard>

            <TremorCard>
              <Title>Rata-rata Nilai Transaksi</Title>
              <BarChart
                className="mt-4"
                data={cashierMetrics}
                index="name"
                categories={["averageTransaction"]}
                colors={["purple"]}
                valueFormatter={value => formatCurrency(value)}
              />
            </TremorCard>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {cashierMetrics.map(metric => (
              <Card key={metric.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{metric.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Penjualan:</span>
                    <span className="font-medium">{formatCurrency(metric.totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jumlah Transaksi:</span>
                    <span className="font-medium">{metric.totalTransactions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Item:</span>
                    <span className="font-medium">{metric.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rata-rata Transaksi:</span>
                    <span className="font-medium">{formatCurrency(metric.averageTransaction)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
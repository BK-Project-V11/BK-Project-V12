import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import * as db from '@/lib/db';
import {
  calculateSubtotal,
  calculateTaxAmount,
  calculateTotal,
  formatToRupiah
} from '@/lib/calculations';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  sku: string;
  description?: string;
  image?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TaxType {
  id: string;
  name: string;
  rate: number;
}

export interface SaleTax {
  id: string;
  sale_id: string;
  tax_type_id: string;
  tax_amount: number;
  tax_types?: TaxType;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
  product?: Product;
}

export interface Sale {
  id: string;
  created_at: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  payment_method: 'cash' | 'card' | 'qris';
  cashier_id: string;
  status: 'completed' | 'cancelled' | 'pending';
  sale_items: SaleItem[];
  sales_taxes: SaleTax[];
}



export interface TaxSettings {
  taxTypes: TaxType[];
}

interface POSState {
  products: Product[];
  cart: CartItem[];
  sales: Sale[];
  taxSettings: TaxSettings;
  isLoading: boolean;
  error: string | null;
}

type POSAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'SET_SALES'; sales: Sale[] }
  | { type: 'SET_TAX_SETTINGS'; taxSettings: TaxSettings }
  | { type: 'ADD_PRODUCT'; product: Product }
  | { type: 'UPDATE_PRODUCT'; id: string; product: Partial<Product> }
  | { type: 'DELETE_PRODUCT'; id: string }
  | { type: 'ADD_TO_CART'; product: Product; quantity: number }
  | { type: 'UPDATE_CART_ITEM'; productId: string; quantity: number }
  | { type: 'REMOVE_FROM_CART'; productId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_SALE'; sale: Sale }
  | { type: 'UPDATE_SALE'; id: string; sale: Partial<Sale> }
  | { type: 'DELETE_SALE'; id: string };

// Sample seed data
const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Premium Coffee Beans',
    price: 24.99,
    stock: 50,
    category: 'Beverages',
    sku: 'BEV-001',
    description: 'High-quality arabica coffee beans'
  },
  {
    id: '2',
    name: 'Organic Green Tea',
    price: 15.99,
    stock: 30,
    category: 'Beverages',
    sku: 'BEV-002',
    description: 'Premium organic green tea leaves'
  },
  {
    id: '3',
    name: 'Chocolate Croissant',
    price: 4.50,
    stock: 15,
    category: 'Bakery',
    sku: 'BAK-001',
    description: 'Fresh baked chocolate croissant'
  },
  {
    id: '4',
    name: 'Blueberry Muffin',
    price: 3.75,
    stock: 8,
    category: 'Bakery',
    sku: 'BAK-002',
    description: 'Homemade blueberry muffin'
  },
  {
    id: '5',
    name: 'Caesar Salad',
    price: 12.99,
    stock: 20,
    category: 'Food',
    sku: 'FOO-001',
    description: 'Fresh caesar salad with parmesan'
  }
];

const initialState: POSState = {
  products: [],
  cart: [],
  sales: [],
  taxSettings: {
    taxTypes: []
  },
  isLoading: true,
  error: null
};

const posReducer = (state: POSState, action: POSAction): POSState => {
  switch (action.type) {
    case 'ADD_PRODUCT':
      return {
        ...state,
        products: [...state.products, action.product]
      };

    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p =>
          p.id === action.id ? { ...p, ...action.product } : p
        )
      };

    case 'DELETE_PRODUCT':
      return {
        ...state,
        products: state.products.filter(p => p.id !== action.id)
      };

    case 'ADD_TO_CART': {
      const existingItem = state.cart.find(item => item.product.id === action.product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + action.quantity;
        if (newQuantity > action.product.stock) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${action.product.stock} items available`,
            variant: "destructive"
          });
          return state;
        }
        
        return {
          ...state,
          cart: state.cart.map(item =>
            item.product.id === action.product.id
              ? { ...item, quantity: newQuantity }
              : item
          )
        };
      } else {
        if (action.quantity > action.product.stock) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${action.product.stock} items available`,
            variant: "destructive"
          });
          return state;
        }
        
        return {
          ...state,
          cart: [...state.cart, { product: action.product, quantity: action.quantity }]
        };
      }
    }

    case 'UPDATE_CART_ITEM': {
      if (action.quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter(item => item.product.id !== action.productId)
        };
      }
      
      const product = state.products.find(p => p.id === action.productId);
      if (product && action.quantity > product.stock) {
        toast({
          title: "Insufficient Stock",
          description: `Only ${product.stock} items available`,
          variant: "destructive"
        });
        return state;
      }
      
      return {
        ...state,
        cart: state.cart.map(item =>
          item.product.id === action.productId
            ? { ...item, quantity: action.quantity }
            : item
        )
      };
    }

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.product.id !== action.productId)
      };

    case 'CLEAR_CART':
      return {
        ...state,
        cart: []
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.loading
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error
      };

    case 'SET_PRODUCTS':
      return {
        ...state,
        products: action.products
      };

    case 'SET_SALES':
      return {
        ...state,
        sales: action.sales
      };

    case 'SET_TAX_SETTINGS':
      return {
        ...state,
        taxSettings: action.taxSettings
      };

    case 'UPDATE_SALE':
      return {
        ...state,
        sales: state.sales.map(sale =>
          sale.id === action.id ? { ...sale, ...action.sale } : sale
        )
      };

    case 'DELETE_SALE':
      return {
        ...state,
        sales: state.sales.filter(sale => sale.id !== action.id)
      };

    default:
      return state;
  }
};

interface POSContextType {
  state: POSState;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addToCart: (product: Product, quantity: number) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  completeSale: (paymentMethod: 'cash' | 'card' | 'qris') => void;
  updateSale: (id: string, sale: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  calculateTotals: () => { subtotal: number; taxes: { id: string; saleId: string; taxTypeId: string; taxAmount: number; }[]; total: number };
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(posReducer, initialState);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        const [products, sales, taxTypes] = await Promise.all([
          db.fetchProducts(),
          db.fetchSales(),
          db.getTaxTypes()
        ]);

        dispatch({ type: 'SET_PRODUCTS', products });
        dispatch({ type: 'SET_SALES', sales });
        dispatch({ 
          type: 'SET_TAX_SETTINGS', 
          taxSettings: { taxTypes } 
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', error: (error as Error).message });
        toast({
          title: "Gagal Memuat Data",
          description: `Terjadi kesalahan saat memuat data: ${(error as Error).message}. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.`,
          variant: "destructive"
        });
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    };

    loadInitialData();
  }, []);

  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const newProduct = await db.addProduct(product);
      dispatch({ type: 'ADD_PRODUCT', product: newProduct });
      toast({
        title: "Produk Ditambahkan",
        description: "Produk baru berhasil ditambahkan",
      });
    } catch (error) {
      toast({
        title: "Gagal Menambahkan Produk",
        description: "Terjadi kesalahan saat menambahkan produk. Pastikan semua data telah diisi dengan benar dan tidak ada SKU yang duplikat.",
        variant: "destructive"
      });
      throw error;
    }
  };

    const updateProduct = async (id: string, updatedData: Partial<Product>) => {
    try {
      // Update in database first
      await db.updateProduct(id, updatedData);
      
      // If database update succeeds, update local state
      dispatch({
        type: 'UPDATE_PRODUCT',
        id,
        product: updatedData
      });

      toast({
        title: "Produk Diperbarui",
        description: "Data produk berhasil diperbarui",
      });
    } catch (error) {
      toast({
        title: "Gagal Memperbarui Produk",
        description: "Terjadi kesalahan saat memperbarui produk. Pastikan data valid dan produk masih tersedia.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await db.deleteProduct(id);
      dispatch({ type: 'DELETE_PRODUCT', id });
      toast({
        title: "Produk Dihapus",
        description: "Produk berhasil dihapus",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menghapus produk",
        variant: "destructive"
      });
      throw error;
    }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    dispatch({ type: 'ADD_TO_CART', product, quantity });
  };

  const updateCartItem = (productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_CART_ITEM', productId, quantity });
  };

  const removeFromCart = (productId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', productId });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const completeSale = async (paymentMethod: 'cash' | 'card' | 'qris') => {
    const { subtotal, taxes, total } = calculateTotals();
    
    try {
      // Validasi total
      if (total <= 0) {
        throw new Error('Total transaksi tidak valid');
      }
      // Validasi keranjang
      if (state.cart.length === 0) {
        throw new Error("Keranjang belanja masih kosong. Silakan tambahkan produk terlebih dahulu.");
      }

      // Validasi stok
      const stockErrors = state.cart.filter(item => {
        const currentProduct = state.products.find(p => p.id === item.product.id);
        return currentProduct && item.quantity > currentProduct.stock;
      });

      if (stockErrors.length > 0) {
        const errorProducts = stockErrors.map(item => {
          const currentStock = state.products.find(p => p.id === item.product.id)?.stock || 0;
          return `${item.product.name} (Stok tersisa: ${currentStock}, Permintaan: ${item.quantity})`;
        }).join('\n');
        
        throw new Error(`Stok tidak mencukupi untuk produk berikut:\n${errorProducts}`);
      }

      const sale = await db.createSale(state.cart, subtotal, taxes, total, paymentMethod);
      
      // Update local products state with new stock values
      const updatedProducts = state.products.map(product => {
        const cartItem = state.cart.find(item => item.product.id === product.id);
        if (cartItem) {
          return {
            ...product,
            stock: product.stock - cartItem.quantity
          };
        }
        return product;
      });
      
      dispatch({ type: 'SET_PRODUCTS', products: updatedProducts });
      dispatch({ type: 'ADD_SALE', sale });
      dispatch({ type: 'CLEAR_CART' });

      const paymentMethods = {
        cash: 'Tunai',
        card: 'Kartu',
        qris: 'QRIS'
      };

      toast({
        title: "Transaksi Berhasil",
        description: `Pembayaran via ${paymentMethods[paymentMethod]} sebesar Rp${total.toLocaleString('id-ID')} telah selesai.\nStruk akan dicetak otomatis.`,
      });
      
      // Update local products stock
      state.cart.forEach(item => {
        dispatch({
          type: 'UPDATE_PRODUCT',
          id: item.product.id,
          product: { stock: item.product.stock - item.quantity }
        });
      });

      toast({
        title: "Transaksi Selesai",
        description: "Pembayaran berhasil diproses",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memproses transaksi",
        variant: "destructive"
      });
      throw error;
    }
  };



  const updateSale = async (id: string, sale: Partial<Sale>) => {
    try {
      await db.updateSale(id, sale);
      dispatch({ type: 'UPDATE_SALE', id, sale });
      toast({
        title: "Transaksi Diperbarui",
        description: "Data transaksi berhasil diperbarui",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memperbarui transaksi",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await db.deleteSale(id);
      dispatch({ type: 'DELETE_SALE', id });
      toast({
        title: "Transaksi Dihapus",
        description: "Data transaksi berhasil dihapus",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menghapus transaksi",
        variant: "destructive"
      });
      throw error;
    }
  };

  const calculateTotals = () => {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    let total = subtotal;
    const taxes = state.taxSettings.taxTypes
      .filter(tax => tax.enabled)
      .map(tax => {
        const taxAmount = (subtotal * tax.rate) / 100;
        total += taxAmount;
        return {
          id: '',
          saleId: '',
          taxTypeId: tax.id,
          taxAmount
        };
      });
    return { subtotal, taxes, total };
  };

  const contextValue: POSContextType = {
    state,
    addProduct,
    updateProduct,
    deleteProduct,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    completeSale,
    updateSale,
    deleteSale,
    calculateTotals
  };

  return (
    <POSContext.Provider value={contextValue}>
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
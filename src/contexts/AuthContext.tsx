import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { initializeDatabase } from '../lib/initDatabase';
import { toast } from '../hooks/use-toast';

interface SignUpData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  role?: string;
  acceptTerms: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
  validatePassword: (password: string) => {
    isValid: boolean;
    score: number;
    feedback: string[];
  };
  updateUserRole: (userId: string, role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = (password: string) => {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Password harus minimal 8 karakter');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Password harus mengandung angka');

    return {
      isValid: score >= 2,
      score,
      feedback
    };
  };

    const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast({
            variant: 'default',
            title: 'Akun Dalam Proses Autentikasi',
            description: 'Akun Anda sedang dalam proses autentikasi. Silakan periksa email Anda untuk tautan verifikasi. Jika belum menerima email, cek folder spam atau hubungi admin.',
          });
        } else {
          toast({
            variant: 'default',
            title: 'Informasi Login',
            description: 'Email/username atau password yang Anda masukkan tidak sesuai. Silakan periksa kembali.',
          });
        }
        return;
      }
      
      await initializeDatabase();
    } catch (error) {
      console.error('Login error:', error);
      toast({
        variant: 'default',
        title: 'Informasi Login',
        description: 'Terjadi kendala saat login. Silakan coba lagi nanti.',
      });
    }
  };

  const signUp = async (data: SignUpData) => {
    try {
      // Check if email already exists
      const { data: existingEmail } = await supabase
        .from('users')
        .select('email')
        .eq('email', data.email)
        .single();

      if (existingEmail) {
        toast({
          variant: 'default',
          title: 'Akun Sudah Terdaftar',
          description: 'Akun dengan email ini sudah terdaftar. Silakan login menggunakan email dan password Anda.',
        });
        return { user: null, session: null };
      }

      // Check if username already exists
      const { data: existingUsername } = await supabase
        .from('users')
        .select('username')
        .eq('username', data.username)
        .single();

      if (existingUsername) {
        toast({
          variant: 'default',
          title: 'Username Tidak Tersedia',
          description: 'Username ini telah digunakan. Silakan pilih username lain yang unik.',
        });
        return { user: null, session: null };
      }

      // Validasi input
      if (!data.email || !data.password || !data.fullName || !data.username) {
        toast({
          variant: 'default',
          title: 'Informasi Pendaftaran',
          description: 'Mohon lengkapi semua field yang wajib diisi.',
        });
        return { user: null, session: null };
      }

      if (!data.acceptTerms) {
        toast({
          variant: 'default',
          title: 'Syarat dan Ketentuan',
          description: 'Anda perlu menyetujui syarat dan ketentuan untuk melanjutkan pendaftaran.',
        });
        return { user: null, session: null };
      }

      if (data.password !== data.confirmPassword) {
        toast({
          variant: 'default',
          title: 'Informasi Password',
          description: 'Password dan konfirmasi password harus sama.',
        });
        return { user: null, session: null };
      }

      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.isValid) {
        toast({
          variant: 'default',
          title: 'Informasi Password',
          description: passwordValidation.feedback.join('\n'),
        });
        return { user: null, session: null };
      }

      // Sign up with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
            full_name: data.fullName,
            role: 'cashier' // Default to cashier, will be overridden by trigger if first user
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          toast({
            variant: 'default',
            title: 'Akun Sudah Terdaftar',
            description: 'Akun ini sudah terdaftar sebelumnya. Silakan login menggunakan email dan password Anda.',
          });
          return { user: null, session: null };
        }
        toast({
          variant: 'default',
          title: 'Informasi Pendaftaran',
          description: 'Terjadi kendala saat mendaftar. Silakan coba lagi atau hubungi admin.',
        });
        return { user: null, session: null };
      }

      const { user, session } = authData;
      if (!user) {
        toast({
          variant: 'default',
          title: 'Informasi Pendaftaran',
          description: 'Terjadi kendala saat membuat akun. Silakan coba lagi nanti.',
        });
        return { user: null, session: null };
      }

      // Create user profile in database
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: data.email,
            username: data.username,
            full_name: data.fullName,
            phone_number: data.phoneNumber,
            address: data.address,
            role: 'cashier' // Default to cashier, will be overridden by database trigger if first user
          },
        ]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        toast({
          variant: 'default',
          title: 'Informasi Pendaftaran',
          description: 'Terjadi kendala saat menyimpan data profil. Silakan coba lagi nanti.',
        });
        return { user: null, session: null };
      }

      toast({
        variant: 'default',
        title: 'Pendaftaran Berhasil',
        description: 'Akun Anda telah berhasil dibuat dan sedang dalam proses autentikasi. Silakan periksa email Anda untuk melakukan verifikasi akun.',
      });

      return { user, session };
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      toast({
        variant: 'default',
        title: 'Informasi Pendaftaran',
        description: 'Terjadi kendala teknis saat mendaftar. Silakan coba beberapa saat lagi.',
      });
      
      return { user: null, session: null };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          variant: 'default',
          title: 'Informasi',
          description: 'Terjadi kendala saat logout. Silakan coba lagi.',
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        variant: 'default',
        title: 'Informasi',
        description: 'Terjadi kendala saat logout. Silakan coba lagi.',
      });
    }
  };

  const value = {
    session,
    user,
    signIn,
    signUp,
    signOut,
    loading,
    validatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
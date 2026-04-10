import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isMockMode } from './supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: 'admin' | 'user' | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  mockSignIn: (isAdmin?: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  isLoading: true,
  signOut: async () => {},
  mockSignIn: (isAdmin) => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isMockMode) {
      // Restore mock session
      const savedMockUser = localStorage.getItem('mockUser');
      const savedMockRole = localStorage.getItem('mockRole');
      if (savedMockUser && savedMockRole) {
        setUser(JSON.parse(savedMockUser));
        setRole(savedMockRole as 'admin' | 'user');
      }
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id, session.user.email).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id, session.user.email).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId?: string, userEmail?: string) => {
    if (!userId) {
      setRole(null);
      return;
    }
    
    // Cấp quyền Admin trực tiếp cho email đặc biệt này mà không cần truy vấn bảng users
    if (userEmail && (userEmail.toLowerCase() === 'banhaomangcut@gmail.com' || userEmail.toLowerCase().includes('admin'))) {
      setRole('admin');
      return;
    }

    try {
      if (isMockMode) throw new Error('Mock mode enabled');
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (data && data.role) {
        setRole(data.role);
      } else {
        setRole('user');
      }
    } catch (error: any) {
      if (error?.message !== 'Mock mode enabled' && !error?.message?.includes('relation "public.users" does not exist')) {
        console.error('Error fetching user role:', error);
      }
      setRole('user');
    }
  };

  const signOut = async () => {
    setUser(null);
    setRole(null);
    if (isMockMode) {
      localStorage.removeItem('mockUser');
      localStorage.removeItem('mockRole');
    } else {
      await supabase.auth.signOut();
    }
  };

  const mockSignIn = (isAdmin: boolean = false) => {
    const mockUser = { id: isAdmin ? 'mock-admin-123' : 'mock-user-123', email: isAdmin ? 'admin@courtkings.vn' : 'demo@courtkings.vn' } as User;
    const mockRole = isAdmin ? 'admin' : 'user';
    
    setUser(mockUser);
    setRole(mockRole);

    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    localStorage.setItem('mockRole', mockRole);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, isLoading, signOut, mockSignIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

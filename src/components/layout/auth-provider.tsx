
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChange, type User } from '@/lib/auth';
import { getLiveGame } from '@/lib/db';
import { LoadingModal } from '@/components/ui/loader';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGameInProgress: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isGameInProgress: false });

const PROTECTED_ROUTES = ['/', '/game', '/roster', '/history', '/tournaments', '/stats', '/settings'];
const PUBLIC_ROUTE = '/login';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGameInProgress, setIsGameInProgress] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkGameStatus = async () => {
        try {
            const game = await getLiveGame();
            setIsGameInProgress(!!game);
        } catch (error) {
            console.error("Failed to check for live game:", error);
            setIsGameInProgress(false);
        }
    };
    
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        checkGameStatus();
      }
      setLoading(false);
    });

    // Add event listeners to re-check when the user focuses the tab.
    window.addEventListener('focus', checkGameStatus);

    return () => {
        unsubscribe();
        window.removeEventListener('focus', checkGameStatus);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route) && pathname !== PUBLIC_ROUTE);
    
    if (!user && isProtectedRoute) {
      router.push(PUBLIC_ROUTE);
    }
    
    if (user && pathname === PUBLIC_ROUTE) {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return <LoadingModal />;
  }
  
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route) && pathname !== PUBLIC_ROUTE);
  if (!user && isProtectedRoute) {
    return <LoadingModal />;
  }

  return <AuthContext.Provider value={{ user, loading, isGameInProgress }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

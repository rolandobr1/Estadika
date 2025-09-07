
'use client';

import type { ElementType } from 'react';
import { BarChart3, Trophy, Users, Zap, ChevronsRight } from 'lucide-react';
import { RiBasketballLine } from "react-icons/ri";
import { ActionCard } from '@/components/ui/action-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/layout/auth-provider';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import type { Game } from '@/lib/types';
import { getFinishedGames }from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const WelcomeHeader = ({ name }: { name: string | null | undefined }) => {
    const title = name ? `Panel de ${name}` : 'Tu Panel de Control';
    return (
        <div className="text-center">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-md">
                <RiBasketballLine className="h-8 w-8 text-primary-foreground"/>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-card-foreground">{title}</h1>
            <p className="mt-2 text-base text-muted-foreground">Tu asistente de baloncesto todo en uno.</p>
        </div>
    );
};


export default function Home() {
  const { user, isGameInProgress } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user !== undefined) {
      setIsLoading(false);
    }
  }, [user]);


  const menuActions: {
      title: string;
      href: string;
      icon: ElementType<{ className?: string }>;
      description: string;
      variant: 'default' | 'accent' | 'active';
  }[] = [
    {
      title: isGameInProgress ? 'Volver al Partido' : 'Iniciar Partido',
      href: isGameInProgress ? '/game/live' : '/game/setup',
      icon: Zap,
      description: isGameInProgress ? 'Continúa donde lo dejaste.' : 'Configura un nuevo juego.',
      variant: isGameInProgress ? 'active' : 'default',
    },
    {
      title: 'Gestión Plantilla',
      href: '/roster',
      icon: Users,
      description: 'Añade y edita tus jugadores y equipos.',
      variant: 'default',
    },
    {
      title: 'Modo Torneo',
      href: '/tournaments',
      icon: Trophy,
      description: 'Crea y administra tus competiciones.',
      variant: 'default',
    },
    {
      title: 'Historial',
      href: '/history',
      icon: BarChart3,
      description: 'Revisa estadísticas de juegos pasados.',
      variant: 'default',
    },
  ];

  return (
      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start gap-8 px-5 pb-24 pt-32 sm:pt-24">
        
        <div className="flex flex-col items-center animate-slide-up z-10 w-full">
            <WelcomeHeader name={user?.displayName} />
            
            <div className="grid gap-4 w-full max-w-sm mt-8">
                 {isLoading ? (
                    <>
                        <Skeleton className="h-[74px] w-full" />
                        <Skeleton className="h-[74px] w-full" />
                        <Skeleton className="h-[74px] w-full" />
                        <Skeleton className="h-[74px] w-full" />
                    </>
                ) : (
                    <>
                        {menuActions.map((action) => (
                            <ActionCard
                                key={action.href}
                                href={action.href}
                                title={action.title}
                                description={action.description}
                                icon={action.icon}
                                variant={action.variant}
                            />
                        ))}
                    </>
                )}
            </div>
        </div>

        <footer className="absolute bottom-6 text-sm text-foreground/60 z-10">
          © {new Date().getFullYear()} Estadika
        </footer>
      </main>
  );
}


'use client';

import type { ElementType } from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, Trophy, Users, Zap } from 'lucide-react';
import { RiBasketballLine } from "react-icons/ri";
import { ActionCard } from '@/components/ui/action-card';


export default function Home() {
  const [activeGame, setActiveGame] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkGameStatus = () => {
      const gameData = localStorage.getItem('liveGame');
      setActiveGame(!!gameData);
    };

    checkGameStatus();
    // These listeners help keep the UI in sync across tabs
    window.addEventListener('storage', checkGameStatus);
    window.addEventListener('focus', checkGameStatus);

    return () => {
      window.removeEventListener('storage', checkGameStatus);
      window.removeEventListener('focus', checkGameStatus);
    };
  }, []);

  const menuActions = [
    {
      title: activeGame ? 'Volver al Partido' : 'Iniciar Partido',
      href: activeGame ? '/game/live' : '/game/setup',
      icon: Zap,
      description: activeGame ? 'Continúa donde lo dejaste.' : 'Configura un nuevo juego.',
      variant: activeGame ? 'accent' : 'default',
    },
    {
      title: 'Gestión Plantilla',
      href: '/roster',
      icon: Users,
      description: 'Añade y edita tus jugadores y equipos.',
      variant: 'default' as const,
    },
    {
      title: 'Modo Torneo',
      href: '/tournaments',
      icon: Trophy,
      description: 'Crea y administra tus competiciones.',
      variant: 'default' as const,
    },
    {
      title: 'Historial',
      href: '/history',
      icon: BarChart3,
      description: 'Revisa estadísticas de juegos pasados.',
      variant: 'default' as const,
    },
  ];

  return (
      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center p-5 gap-8">
        <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-card/95 p-8 shadow-lg backdrop-blur-lg">
          <div className="mb-8 text-center">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-md">
                <RiBasketballLine className="h-8 w-8 text-primary-foreground"/>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-card-foreground">Estadika</h1>
            <p className="mt-2 text-base text-muted-foreground">Tu asistente de baloncesto todo en uno.</p>
          </div>

          <div className="grid gap-3">
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
          </div>
        </div>

        <footer className="absolute bottom-6 text-sm text-foreground/60">
          © {new Date().getFullYear()} Estadika
        </footer>
      </main>
  );
}

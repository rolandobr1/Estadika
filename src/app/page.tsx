
'use client';

import Link from 'next/link';
import type { ElementType } from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, Trophy, Users, Zap } from 'lucide-react';
import type { Game } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RiBasketballLine } from "react-icons/ri";

const MenuButton = ({
  href,
  icon: Icon,
  text,
  variant,
}: {
  href: string;
  icon: ElementType;
  text: string;
  variant: 'iniciar' | 'jugadores' | 'torneo' | 'historial';
}) => {
  const variants = {
    iniciar: 'border-l-teal-600',
    jugadores: 'border-l-sky-600',
    torneo: 'border-l-orange-800',
    historial: 'border-l-gray-700',
  };
  const iconVariants = {
    iniciar: 'bg-green-100 text-teal-600',
    jugadores: 'bg-blue-100 text-sky-600',
    torneo: 'bg-orange-200 text-orange-800',
    historial: 'bg-gray-200 text-gray-700',
  };

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-5 text-left text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-px hover:border-slate-300 hover:bg-slate-100 hover:shadow-md active:translate-y-0 active:shadow-sm',
        variants[variant]
      )}
    >
      <div
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-sm',
          iconVariants[variant]
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1">{text}</span>
      <span className="absolute left-[-100%] top-0 h-full w-full bg-gradient-to-r from-transparent via-slate-700/5 to-transparent transition-all duration-500 group-hover:left-full" />
    </Link>
  );
};


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
      text: activeGame ? 'Volver al Partido' : 'Iniciar Partido',
      href: activeGame ? '/game/live' : '/game/setup',
      icon: Zap,
      variant: 'iniciar' as const,
    },
    {
      text: 'Gestión Jugadores',
      href: '/roster',
      icon: Users,
      variant: 'jugadores' as const,
    },
    {
      text: 'Modo Torneo',
      href: '/tournaments',
      icon: Trophy,
      variant: 'torneo' as const,
    },
    {
      text: 'Estadísticas e Historial',
      href: '/history',
      icon: BarChart3,
      variant: 'historial' as const,
    },
  ];

  return (
      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center p-5">
        <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-card/95 p-10 py-12 text-center shadow-lg backdrop-blur-lg">
          <div className="mb-10">
            <div className="relative mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 shadow-md">
                <RiBasketballLine className="h-8 w-8 text-white"/>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">CourtVision Stats</h1>
            <p className="mt-2 text-base text-slate-500">Tu asistente de baloncesto todo en uno.</p>
          </div>

          <div className="grid gap-3">
            {menuActions.map((action) => (
              <MenuButton
                key={action.href}
                href={action.href}
                text={action.text}
                icon={action.icon}
                variant={action.variant}
              />
            ))}
          </div>
        </div>
        <footer className="absolute bottom-6 text-sm text-foreground/60">
          © {new Date().getFullYear()} CourtVision Stats
        </footer>
      </main>
  );
}

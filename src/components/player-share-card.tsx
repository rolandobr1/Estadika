
'use client';

import { forwardRef } from 'react';
import type { Player } from '@/lib/types';
import { RiBasketballLine } from 'react-icons/ri';

export const PlayerShareCard = forwardRef<HTMLDivElement, { player: Player }>(({ player }, ref) => {
    
    return (
        <div ref={ref} className="w-[1200px] h-[630px] bg-gradient-to-br from-gray-900 to-gray-800 text-white p-16 flex flex-col justify-between font-sans">
            <div className="flex justify-between items-center pb-8 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <RiBasketballLine className="h-10 w-10 text-primary" />
                    <span className="text-3xl font-bold">Estadika</span>
                </div>
                 <p className="text-xl text-white/60">Ficha de Jugador</p>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center text-center">
                 <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-primary/10 border-4 border-primary mb-6">
                    <span className="text-9xl font-black text-white">{player.number ?? '-'}</span>
                 </div>
                 <h1 className="text-8xl font-bold tracking-tight text-white">{player.name}</h1>
                 {player.position && (
                    <h2 className="text-5xl font-semibold text-primary mt-2">{player.position}</h2>
                 )}
            </div>

            <div className="pt-8 border-t border-white/10 text-center">
                <p className="text-lg text-white/70">Tarjeta generada con Estadika, tu asistente de baloncesto.</p>
            </div>
        </div>
    );
});

PlayerShareCard.displayName = 'PlayerShareCard';


'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiBasketballLine } from "react-icons/ri";
import { cn } from '@/lib/utils';
import { LoadingModal } from '@/components/ui/loader';

export default function SpectatorPage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const [game, setGame] = useState<Game | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!gameId || typeof window === 'undefined') {
            setIsLoading(false);
            return;
        };

        const storageKey = `liveGame_${gameId}`;

        const loadGame = () => {
            let gameData = null;
            
            // First, try the specific spectator key
            const specificGameRaw = localStorage.getItem(storageKey);
            if (specificGameRaw) {
                gameData = JSON.parse(specificGameRaw);
            } else {
                 // If not found, try the main liveGame key
                 const mainLiveGameRaw = localStorage.getItem('liveGame');
                 if(mainLiveGameRaw) {
                    const parsedMainGame = JSON.parse(mainLiveGameRaw);
                    // IMPORTANT: Check if the ID matches the one from the URL
                    if(parsedMainGame.id === gameId) {
                        gameData = parsedMainGame;
                    }
                 }
            }
            setGame(gameData);
            setIsLoading(false);
        };

        loadGame();

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === storageKey || (event.key === 'liveGame')) {
                loadGame();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [gameId]);

    const getPeriodDisplay = () => {
        if (!game) return '';
        if (game.isTimeoutActive) {
            return 'Tiempo Muerto';
        }
        if (game.currentQuarter > game.settings.quarters) {
            const overtimeNumber = game.currentQuarter - game.settings.quarters;
            return `Prórroga ${overtimeNumber}`;
        }
        return `Periodo ${game.currentQuarter}`;
    };

    const getClockDisplay = () => {
        if (!game) return '00:00';
        const clock = game.isTimeoutActive ? game.timeoutClock : game.gameClock;
        return `${Math.floor(clock / 60).toString().padStart(2, '0')}:${(clock % 60).toString().padStart(2, '0')}`;
    }

    if (isLoading) {
        return <LoadingModal />;
    }

    if (!game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
                 <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Partido no encontrado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>No se pudo encontrar un partido en vivo con el ID proporcionado. El enlace puede haber expirado o ser incorrecto.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
             <div className="absolute top-6 left-6 flex items-center gap-2">
                <RiBasketballLine className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg">Estadika - Modo Espectador</span>
            </div>
            <Card className="w-full max-w-4xl border-2 shadow-xl">
                 <CardContent className="p-6 md:p-10">
                     <div className="text-center mb-8">
                        <p className="text-2xl font-semibold text-muted-foreground">{getPeriodDisplay()}</p>
                        <div className={cn(
                            "text-7xl md:text-9xl font-mono font-bold tracking-tighter my-2",
                            game.isTimeoutActive ? 'text-orange-500' : 'text-primary'
                        )}>
                            {getClockDisplay()}
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4 md:gap-8 items-center">
                        <div className="text-center space-y-2">
                             <h2 className="text-2xl md:text-4xl font-bold truncate">{game.homeTeam.name}</h2>
                             <p className="text-6xl md:text-8xl font-bold text-primary">{game.homeTeam.stats.score}</p>
                        </div>
                        <div className="text-center space-y-2">
                             <h2 className="text-2xl md:text-4xl font-bold truncate">{game.awayTeam.name}</h2>
                            <p className="text-6xl md:text-8xl font-bold text-primary">{game.awayTeam.stats.score}</p>
                        </div>
                    </div>
                 </CardContent>
            </Card>
             <footer className="absolute bottom-6 text-sm text-muted-foreground">
                Actualizaciones en tiempo real.
            </footer>
        </main>
    );
}

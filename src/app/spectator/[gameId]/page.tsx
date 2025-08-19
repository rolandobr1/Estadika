
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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!gameId || typeof window === 'undefined') {
            setIsLoading(false);
            if (!gameId) setError("No se ha proporcionado un ID de partido.");
            return;
        };

        const getGameFromStorage = (): Game | null => {
            // Check specific spectator key first
            const specificGameRaw = localStorage.getItem(`liveGame_${gameId}`);
            if (specificGameRaw) {
                const parsed = JSON.parse(specificGameRaw);
                if (parsed.id === gameId) return parsed;
            }

            // Check main live game key
            const mainLiveGameRaw = localStorage.getItem('liveGame');
            if (mainLiveGameRaw) {
                const parsed = JSON.parse(mainLiveGameRaw);
                if (parsed.id === gameId) return parsed;
            }
            
            // Check general history
            const generalHistoryRaw = localStorage.getItem('gameHistory');
            if(generalHistoryRaw) {
                const games: Game[] = JSON.parse(generalHistoryRaw);
                const found = games.find((g) => g.id === gameId);
                if(found) return found;
            }

            // Check tournament history
            const tournamentHistoryRaw = localStorage.getItem('tournamentGameHistory');
            if(tournamentHistoryRaw) {
                 const games: Game[] = JSON.parse(tournamentHistoryRaw);
                 const found = games.find((g) => g.id === gameId);
                 if(found) return found;
            }

            return null; // No game found anywhere
        };

        const loadGame = () => {
            const gameData = getGameFromStorage();
            if (gameData) {
                setGame(gameData);
                setError(null);
            } else {
                setGame(null);
                setError("No se pudo encontrar un partido con el ID proporcionado. El enlace puede haber expirado o ser incorrecto.");
            }
            setIsLoading(false);
        };

        loadGame();

        // Listen for storage changes to update in real-time
        const handleStorageChange = (event: StorageEvent) => {
             if (event.key === `liveGame_${gameId}` || event.key === 'liveGame' || event.key === 'gameHistory' || event.key === 'tournamentGameHistory') {
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

    if (error || !game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
                 <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Partido no encontrado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error || "No se pudo encontrar el partido."}</p>
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
                {game.status === 'FINISHED' ? 'Este partido ha finalizado.' : 'Actualizaciones en tiempo real.'}
            </footer>
        </main>
    );
}


'use client';

import { useState, useEffect, useCallback } from 'react';
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
    const [error, setError] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    const updateGameFromStorage = useCallback(() => {
        const gameData = localStorage.getItem('liveGame');
        if (gameData) {
            try {
                const parsedGame = JSON.parse(gameData);
                if (parsedGame.id === gameId) {
                    setGame(parsedGame);
                    setError(null);
                } else {
                    setError("Hay otro partido en curso. El marcador solicitado no está disponible.");
                    setGame(null);
                }
            } catch (e) {
                console.error("Error parsing game data from localStorage", e);
                setError("No se pudieron cargar los datos del partido.");
                setGame(null);
            }
        } else {
            setError("El partido no está en curso o el enlace ha expirado.");
            setGame(null);
        }
    }, [gameId]);

    useEffect(() => {
        // This effect runs only on the client, after the initial render.
        // This ensures localStorage is available and we avoid hydration errors.
        setIsClient(true);

        if (typeof window === 'undefined' || !gameId) {
            return;
        }

        updateGameFromStorage();

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'liveGame') {
                 try {
                    const newGameData = event.newValue;
                    if (newGameData) {
                        const parsedGame = JSON.parse(newGameData);
                        if (parsedGame.id === gameId) {
                            setGame(parsedGame);
                        }
                    } else {
                        // Game was cleared from storage
                        setError("El partido ha finalizado.");
                        setGame(null);
                    }
                } catch (e) {
                     console.error("Error updating game from storage event", e);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [gameId, updateGameFromStorage]);
    
    // On the server and during the initial client render, render nothing to guarantee a match.
    if (!isClient) {
        return null;
    }

    // After client has mounted, show loading state until game or error is determined.
    if (!game && !error) {
        return <LoadingModal />;
    }
    
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
    
    if (error || !game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
                 <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Marcador no Disponible</CardTitle>
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
                <span className="font-bold text-lg">CourtVision Stats - Modo Espectador</span>
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

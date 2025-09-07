
'use client';

import { forwardRef, useMemo } from 'react';
import type { Game, Player, PlayerStats } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RiBasketballLine } from 'react-icons/ri';
import { Crown } from 'lucide-react';
import { calculateEfficiency } from '@/lib/game-utils';


const PlayerHighlight = ({ player, teamName, isWinner }: { player: Player & { stats: PlayerStats } | null, teamName: string, isWinner: boolean }) => {
    if (!player) return (
        <div className="flex-1 p-4 bg-white/5 rounded-lg flex items-center justify-center">
            <p className="text-sm text-white/50">No hay jugador destacado</p>
        </div>
    );

    return (
        <div className={cn("flex-1 p-4 rounded-lg", isWinner ? "bg-white/10" : "bg-white/5")}>
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-white/80">{teamName}</h4>
                <Crown className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white font-bold text-xl">
                    {player.number ?? '-'}
                </div>
                <div>
                    <h3 className="font-bold text-lg text-white truncate">{player.name}</h3>
                    <p className="text-sm text-white/70">
                        {player.stats.PTS} PTS / {player.stats.REB} REB / {player.stats.AST} AST
                    </p>
                </div>
            </div>
        </div>
    )
}

export const ShareCard = forwardRef<HTMLDivElement, { game: Game }>(({ game }, ref) => {
    const standoutPlayers = useMemo(() => {
        let homeBest: (Player & { stats: PlayerStats }) | null = null;
        let awayBest: (Player & { stats: PlayerStats }) | null = null;
        let maxHomeEfficiency = -Infinity;
        let maxAwayEfficiency = -Infinity;

        const processTeam = (team: Game['homeTeam'], isHome: boolean) => {
            team.players.forEach(player => {
                const stats = team.playerStats[player.id];
                if (!stats) return;
                const efficiency = calculateEfficiency(stats);
                if (isHome) {
                    if (efficiency > maxHomeEfficiency) {
                        maxHomeEfficiency = efficiency;
                        homeBest = { ...player, stats };
                    }
                } else {
                    if (efficiency > maxAwayEfficiency) {
                        maxAwayEfficiency = efficiency;
                        awayBest = { ...player, stats };
                    }
                }
            });
        };

        processTeam(game.homeTeam, true);
        processTeam(game.awayTeam, false);
        return { home: homeBest, away: awayBest };
    }, [game]);

    const homeIsWinner = game.homeTeam.stats.score > game.awayTeam.stats.score;
    const awayIsWinner = game.awayTeam.stats.score > game.homeTeam.stats.score;
    
    // Card dimensions: 1200x630 for good social media preview (e.g., Twitter, Facebook)
    return (
        <div ref={ref} className="w-[1200px] h-[630px] bg-gradient-to-br from-gray-900 to-gray-800 text-white p-16 flex flex-col font-sans">
            {/* Header */}
            <div className="flex justify-between items-center pb-8 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <RiBasketballLine className="h-10 w-10 text-primary" />
                    <span className="text-3xl font-bold">Estadika</span>
                </div>
                {game.settings.name && <p className="text-xl text-white/60">{game.settings.name}</p>}
            </div>

            {/* Main Score */}
            <div className="flex-grow flex flex-col items-center justify-center">
                 <div className="flex items-center justify-around w-full">
                    <div className="text-center w-[40%]">
                        <h2 className={cn("text-5xl font-bold truncate", homeIsWinner ? "text-white" : "text-white/70")}>{game.homeTeam.name}</h2>
                    </div>
                    <div className="text-center w-[20%]">
                        <h1 className={cn("text-9xl font-black text-primary", homeIsWinner && "text-yellow-400")}>{game.homeTeam.stats.score}</h1>
                    </div>
                    <div className="text-center w-[20%]">
                        <h1 className={cn("text-9xl font-black", awayIsWinner && "text-yellow-400")}>{game.awayTeam.stats.score}</h1>
                    </div>
                    <div className="text-center w-[40%]">
                        <h2 className={cn("text-5xl font-bold truncate", awayIsWinner ? "text-white" : "text-white/70")}>{game.awayTeam.name}</h2>
                    </div>
                </div>
            </div>

            {/* Footer with MVPs */}
            <div className="pt-8 border-t border-white/10">
                <h3 className="text-center text-xl font-semibold mb-4 text-white/80">Jugadores Destacados</h3>
                <div className="flex gap-8">
                   <PlayerHighlight player={standoutPlayers.home} teamName={game.homeTeam.name} isWinner={homeIsWinner} />
                   <PlayerHighlight player={standoutPlayers.away} teamName={game.awayTeam.name} isWinner={awayIsWinner} />
                </div>
            </div>
        </div>
    );
});

ShareCard.displayName = 'ShareCard';

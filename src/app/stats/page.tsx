
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { produce } from 'immer';
import type { Tournament, TournamentTeam, TournamentMatch, Game, GameSettings, TeamInGame, PlayerStats, Player, AggregatedPlayerStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Play, Trash2, Wand2, ChevronsRight, RotateCw, PlusCircle, Search, ArrowUpDown, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle as DialogTitleComponent, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { LoadingModal } from '@/components/ui/loader';
import { getTournamentById, getFinishedGames, saveTournament, deleteLiveGame, saveLiveGame, getLiveGame, deleteFinishedGames, deleteTournament as deleteTournamentFromDb } from '@/lib/db';
import { createInitialPlayerStats, createInitialGame } from '@/lib/game-utils';

const StandingsTable = ({ teams, matches }: { teams: TournamentTeam[], matches: TournamentMatch[] }) => {
    const sortedTeams = useMemo(() => {
        
        const teamsWithStats = teams.map(team => {
            let wins = 0;
            let losses = 0;
            let pointsFor = 0;
            let pointsAgainst = 0;

            matches.forEach(match => {
                if (match.status !== 'FINISHED') return;

                const isTeam1 = match.team1.id === team.id;
                const isTeam2 = match.team2.id === team.id;

                if (isTeam1 || isTeam2) {
                    const teamScore = isTeam1 ? (match.team1.score ?? 0) : (match.team2.score ?? 0);
                    const opponentScore = isTeam1 ? (match.team2.score ?? 0) : (match.team1.score ?? 0);

                    pointsFor += teamScore;
                    pointsAgainst += opponentScore;

                    if (teamScore > opponentScore) {
                        wins++;
                    } else if (opponentScore > teamScore) {
                        losses++;
                    }
                }
            });
            return { ...team, wins, losses, pointsFor, pointsAgainst };
        });

        return teamsWithStats.sort((a, b) => {
            if (a.wins !== b.wins) return b.wins - a.wins;
            const pointsDiffA = a.pointsFor - a.pointsAgainst;
            const pointsDiffB = b.pointsFor - b.pointsAgainst;
            if (pointsDiffA !== pointsDiffB) return pointsDiffB - pointsDiffA;
            return b.pointsFor - a.pointsFor;
        });
    }, [teams, matches]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tabla de Posiciones</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Pos</TableHead>
                            <TableHead>Equipo</TableHead>
                            <TableHead className="text-center">V</TableHead>
                            <TableHead className="text-center">D</TableHead>
                            <TableHead className="text-center">PF</TableHead>
                            <TableHead className="text-center">PC</TableHead>
                            <TableHead className="text-center">Dif</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedTeams.map((team, index) => (
                            <TableRow key={team.id}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell className="font-semibold">{team.name}</TableCell>
                                <TableCell className="text-center">{team.wins}</TableCell>
                                <TableCell className="text-center">{team.losses}</TableCell>
                                <TableCell className="text-center">{team.pointsFor}</TableCell>
                                <TableCell className="text-center">{team.pointsAgainst}</TableCell>
                                <TableCell className="text-center font-medium">{team.pointsFor - team.pointsAgainst}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const AddMatchModal = ({
    isOpen,
    onClose,
    onAddMatch,
    teams,
}: {
    isOpen: boolean;
    onClose: () => void;
    onAddMatch: (team1Id: string, team2Id: string) => void;
    teams: TournamentTeam[];
}) => {
    const [team1, setTeam1] = useState<string | null>(null);
    const [team2, setTeam2] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        if (!team1 || !team2) {
            setError("Debes seleccionar ambos equipos.");
            return;
        }
        if (team1 === team2) {
            setError("Los equipos deben ser diferentes.");
            return;
        }
        onAddMatch(team1, team2);
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            setTeam1(null);
            setTeam2(null);
            setError(null);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitleComponent>Añadir Nuevo Partido</DialogTitleComponent>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Equipo Local</Label>
                        <Select onValueChange={setTeam1} value={team1 || undefined}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un equipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Equipo Visitante</Label>
                         <Select onValueChange={setTeam2} value={team2 || undefined}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un equipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map(t => (
                                    <SelectItem key={t.id} value={t.id} disabled={t.id === team1}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit}>Guardar Partido</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const Schedule = ({ tournament, onUpdate }: { tournament: Tournament, onUpdate: (updatedTournament: Tournament) => void }) => {
    const { toast } = useToast();
    const router = useRouter();
    const [showGameInProgressDialog, setShowGameInProgressDialog] = useState(false);
    const [liveGameInfo, setLiveGameInfo] = useState<{id: string, tournamentId?: string, matchId?: string} | null | undefined>(undefined);
    const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);
    const [isStartingMatch, setIsStartingMatch] = useState(false);

    useEffect(() => {
        const checkLiveGame = async () => {
            if (typeof window === 'undefined') return;
            const liveGameData = await getLiveGame();
            setLiveGameInfo(liveGameData);
        };

        checkLiveGame();
        // Listen for storage changes to update UI in real-time if a game ends in another tab
        const interval = setInterval(checkLiveGame, 2000); // Check every 2 seconds
        return () => {
            clearInterval(interval);
        };
    }, []);

    const getTeamName = (teamId: string) => tournament.teams.find(t => t.id === teamId)?.name || 'Equipo no encontrado';
    
    const regularSeasonMatches = tournament.matches.filter(m => m.stage === 'regular-season');
    const finalMatches = tournament.matches.filter(m => m.stage === 'final');
    
    const allRegularSeasonFinished = regularSeasonMatches.length > 0 && regularSeasonMatches.every(m => m.status === 'FINISHED');

    const handleResumeGame = () => {
        router.push('/game/live');
    };

    const handleAddMatch = (team1Id: string, team2Id: string) => {
         const newMatch: TournamentMatch = {
            id: `match_${tournament.id}_${Date.now()}`,
            team1: { id: team1Id },
            team2: { id: team2Id },
            status: 'PENDING',
            stage: 'regular-season',
        };
        const updatedTournament = produce(tournament, draft => {
            draft.matches.push(newMatch);
        });
        onUpdate(updatedTournament);
        toast({ title: "Partido Añadido", description: "El nuevo partido ha sido añadido al calendario." });
    };

    const handleStartMatch = async (match: TournamentMatch) => {
        if (typeof window === 'undefined') return;
        const currentLiveGame = await getLiveGame();
        if (currentLiveGame) {
            setShowGameInProgressDialog(true);
            return;
        }

        setIsStartingMatch(true);

        const homeTournamentTeam = tournament.teams.find(t => t.id === match.team1.id);
        const awayTournamentTeam = tournament.teams.find(t => t.id === match.team2.id);

        if (!homeTournamentTeam || !awayTournamentTeam) {
            toast({ title: "Error", description: "No se pudieron encontrar los datos de uno de los equipos.", variant: "destructive" });
            setIsStartingMatch(false);
            return;
        }
        
        const appSettingsString = localStorage.getItem('appSettings');
        const appSettings = appSettingsString ? JSON.parse(appSettingsString) : {};

        const gameSettings: GameSettings = {
            ...(appSettings.gameSettings || {}),
            ...tournament.gameSettings,
            quarterLength: (tournament.gameSettings.quarterLength || appSettings.gameSettings.quarterLength || 10), // Keep in minutes for UI setup
            overtimeLength: (tournament.gameSettings.overtimeLength || appSettings.gameSettings.overtimeLength || 5), // Keep in minutes
            name: `${homeTournamentTeam.name} vs ${awayTournamentTeam.name} (${tournament.name})`,
        };
        
        // Let's create the game object with seconds for the game logic
        const newGame: Game = createInitialGame();
        
        const getInitialTimeouts = () => {
            const { timeoutSettings } = gameSettings;
            switch (timeoutSettings.mode) {
                case 'per_quarter': return timeoutSettings.timeoutsPerQuarter;
                 case 'per_quarter_custom': return timeoutSettings.timeoutsPerQuarterValues[0] ?? 0;
                case 'per_half': return timeoutSettings.timeoutsFirstHalf;
                case 'total': return timeoutSettings.timeoutsTotal;
                default: return 2;
            }
        };

        const createTeamInGame = (tournTeam: TournamentTeam, teamId: 'homeTeam' | 'awayTeam'): TeamInGame => ({
            id: teamId,
            name: tournTeam.name,
            players: tournTeam.players,
            stats: { 
                score: 0, 
                timeouts: getInitialTimeouts(),
                foulsByQuarter: Array(gameSettings.quarters + 10).fill(0),
                inBonus: false,
            },
            playerStats: tournTeam.players.reduce((acc, player) => {
                acc[player.id] = createInitialPlayerStats();
                return acc;
            }, {} as Record<string, PlayerStats>),
            playersOnCourt: tournTeam.players.slice(0, 5).map(p => p.id),
        });
        
        const finalGameSettings = {
             ...gameSettings,
            quarterLength: gameSettings.quarterLength * 60,
            overtimeLength: gameSettings.overtimeLength * 60,
        };

        newGame.id = `game_${match.id}`;
        newGame.settings = finalGameSettings;
        newGame.homeTeam = createTeamInGame(homeTournamentTeam, 'homeTeam');
        newGame.awayTeam = createTeamInGame(awayTournamentTeam, 'awayTeam');
        newGame.tournamentId = tournament.id;
        newGame.matchId = match.id;
        
        await saveLiveGame(newGame);
        
        toast({ title: "¡Partido Iniciado!", description: "Redirigiendo a la pantalla de juego." });
        router.push('/game/live');
    };

    const handleGenerateFinal = () => {
        if (tournament.teams.length < 2) {
            toast({ title: "No hay suficientes equipos para una final.", variant: "destructive" });
            return;
        }

        const sortedTeams = [...tournament.teams].sort((a, b) => {
            if (a.wins !== b.wins) return b.wins - a.wins;
            const pointsDiffA = a.pointsFor - a.pointsAgainst;
            const pointsDiffB = b.pointsFor - b.pointsAgainst;
            if (pointsDiffA !== pointsDiffB) return pointsDiffB - pointsDiffA;
            return b.pointsFor - a.pointsFor;
        });
        
        const topTwoTeams = sortedTeams.slice(0, 2);
        const [team1, team2] = topTwoTeams;

        let newFinalMatches: TournamentMatch[] = [];
        const finalType = tournament.playoffSettings.finalFormat;

        if (finalType === 'best-of-3') {
            for(let i=1; i<=3; i++) {
                 newFinalMatches.push({
                    id: `match_${tournament.id}_final_game${i}`,
                    team1: { id: team1.id },
                    team2: { id: team2.id },
                    status: 'PENDING',
                    stage: 'final',
                });
            }
        }
        
        const updatedTournament = produce(tournament, draft => {
            // Remove any old final matches and add the new ones
            draft.matches = draft.matches.filter(m => m.stage !== 'final');
            draft.matches.push(...newFinalMatches);
        });

        onUpdate(updatedTournament);
         toast({ title: "Final Generada", description: `La final entre ${team1.name} y ${team2.name} ha sido creada.` });
    };

    const renderMatchControls = (match: TournamentMatch) => {
        if (liveGameInfo === undefined) {
            return <Skeleton className="h-9 w-32" />;
        }

        const isMatchInProgress = liveGameInfo?.matchId === match.id;

        if (match.status === 'FINISHED') {
             return (
                <div className="text-center">
                     <p className="font-bold text-lg">{match.team1.score} - {match.team2.score}</p>
                     <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs">
                        <Link href={`/history?gameId=${match.gameId}&tournamentId=${tournament.id}`}>Ver Resumen</Link>
                     </Button>
                </div>
            );
        }
        
        if (isMatchInProgress) {
            return (
                 <Button size="sm" onClick={handleResumeGame}>
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                    Reanudar Partido
                </Button>
            );
        }

        return (
             <Button size="sm" onClick={() => handleStartMatch(match)} disabled={isStartingMatch}>
                <Play className="mr-2 h-4 w-4" />
                Empezar Partido
            </Button>
        );
    };

    return (
        <>
        {isStartingMatch && <LoadingModal text="Iniciando partido..."/>}
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Temporada Regular</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setIsAddMatchModalOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Partido
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     {(!regularSeasonMatches || regularSeasonMatches.length === 0) ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-md flex flex-col items-center gap-4">
                            <p className="text-lg font-medium text-muted-foreground">No hay partidos en el calendario.</p>
                            <Button onClick={() => setIsAddMatchModalOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Añadir tu Primer Partido
                            </Button>
                        </div>
                     ) : (
                        <div className="space-y-3">
                            {regularSeasonMatches.map(match => (
                                 <Card key={match.id} className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                                            <span className="font-semibold">{getTeamName(match.team1.id)}</span>
                                            <span className="text-muted-foreground text-sm">vs</span>
                                            <span className="font-semibold">{getTeamName(match.team2.id)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {renderMatchControls(match)}
                                        </div>
                                    </div>
                                 </Card>
                            ))}
                        </div>
                     )}
                </CardContent>
            </Card>

            {tournament.playoffSettings.enabled && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Playoffs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {finalMatches.length === 0 ? (
                             <div className="text-center py-10 border-2 border-dashed rounded-md flex flex-col items-center gap-4">
                                <p className="text-lg font-medium text-muted-foreground">La final no se ha generado.</p>
                                <p className="text-sm text-muted-foreground max-w-xs">Una vez que todos los partidos de la temporada regular hayan finalizado, podrás generar la final.</p>
                                <Button onClick={handleGenerateFinal} disabled={!allRegularSeasonFinished}>
                                    <Wand2 className="mr-2 h-4 w-4" /> Generar Final
                                </Button>
                             </div>
                        ) : (
                             <div className="space-y-3">
                                {finalMatches.map((match, index) => (
                                     <Card key={match.id} className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                                                <span className="font-semibold text-primary">Final - Partido {index + 1}</span>
                                                <span className="font-semibold">{getTeamName(match.team1.id)}</span>
                                                <span className="text-muted-foreground text-sm">vs</span>
                                                <span className="font-semibold">{getTeamName(match.team2.id)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 {renderMatchControls(match)}
                                            </div>
                                        </div>
                                     </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
             <AlertDialog open={showGameInProgressDialog} onOpenChange={setShowGameInProgressDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Juego en Curso Detectado</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ya hay un partido en progreso. Por favor, finaliza o borra el partido actual antes de comenzar uno nuevo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResumeGame}>Ir al Partido Actual</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        <AddMatchModal
            isOpen={isAddMatchModalOpen}
            onClose={() => setIsAddMatchModalOpen(false)}
            onAddMatch={handleAddMatch}
            teams={tournament.teams}
        />
        </>
    )
}

const HistoryTab = ({ games, onResumeGame }: { games: Game[], onResumeGame: (game: Game) => void }) => {
    if (games.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sin Historial</CardTitle>
                    <CardDescription>Aún no se han completado partidos en este torneo.</CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    return (
        <div className="border rounded-lg">
             <div className="space-y-0">
                {games.map((game) => (
                    <div key={game.id} className={`p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 border-b last:border-b-0`}>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className="font-bold text-lg text-primary">{game.homeTeam.stats.score}</div>
                                <div className="font-medium text-sm">{game.homeTeam.name}</div>
                            </div>
                            <div className="text-muted-foreground text-sm">VS</div>
                            <div className="text-center">
                                <div className="font-bold text-lg">{game.awayTeam.stats.score}</div>
                                <div className="font-medium text-sm">{game.awayTeam.name}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="secondary" size="sm">
                                        <RotateCcw className="h-4 w-4 mr-2" /> Reanudar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Reanudar este partido?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            El partido se cargará como el partido en vivo y se eliminará del historial del torneo para evitar duplicados. Podrás volver a guardarlo cuando termines.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onResumeGame(game)}>Sí, Reanudar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                           <Button asChild variant="ghost" size="sm">
                             <Link href={`/history?gameId=${game.id}&tournamentId=${game.tournamentId}`}>
                                Detalles <ChevronsRight className="h-4 w-4 ml-2" />
                             </Link>
                           </Button>
                        </div>
                    </div>
                  ))}
              </div>
        </div>
    );
};


type SortKey = keyof AggregatedPlayerStats['totals'] | 'name' | 'gamesPlayed' | 'PPG' | 'RPG' | 'APG' | 'SPG' | 'BPG';

const statKeyMap: { [key in SortKey]?: keyof PlayerStats } = {
    PPG: 'PTS',
    RPG: 'REB',
    APG: 'AST',
    SPG: 'STL',
    BPG: 'BLK',
};

const calculateAverages = (totals: PlayerStats, gamesPlayed: number): AggregatedPlayerStats['averages'] => {
    const averages: any = {};
    for (const key in totals) {
        const statKey = key as keyof PlayerStats;
        if (gamesPlayed > 0) {
            averages[statKey] = parseFloat((totals[statKey] / gamesPlayed).toFixed(1));
        } else {
            averages[statKey] = 0;
        }
    }
    averages.PPG = averages.PTS;
    averages.RPG = averages.REB;
    averages.APG = averages.AST;
    averages.SPG = averages.STL;
    averages.BPG = averages.BLK;
    delete averages.PTS;
    return averages;
};

const StatsTab = ({ games, teams }: { games: Game[], teams: TournamentTeam[] }) => {
    const [stats, setStats] = useState<AggregatedPlayerStats[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'PPG', direction: 'desc' });
    const [teamFilter, setTeamFilter] = useState('all');
    const [positionFilter, setPositionFilter] = useState('all');

    const availablePositions = useMemo(() => {
        const positions = new Set<string>();
        teams.forEach(team => {
            team.players.forEach(player => {
                if (player.position) {
                    positions.add(player.position);
                }
            });
        });
        return Array.from(positions);
    }, [teams]);
     
    useEffect(() => {
        const playerStatsMap = new Map<string, { playerInfo: Player, teamId: string, teamName: string, totals: PlayerStats, gamesPlayed: number }>();
        
        // Initialize all players in the tournament with 0 stats
        teams.forEach(team => {
            team.players.forEach(player => {
                if (!playerStatsMap.has(player.id)) {
                    playerStatsMap.set(player.id, {
                        playerInfo: { ...player },
                        teamId: team.id,
                        teamName: team.name,
                        totals: createInitialPlayerStats(),
                        gamesPlayed: 0
                    });
                }
            });
        });
        
        games.forEach(game => {
            const processTeam = (team: TeamInGame, teamId: 'homeTeam' | 'awayTeam') => {
                const tournamentTeamData = teamId === 'homeTeam' ? game.homeTeam : game.awayTeam;
                
                team.players.forEach((player: Player) => {
                    if (!playerStatsMap.has(player.id)) return;
                    
                    const current = playerStatsMap.get(player.id)!;
                    const gameStats = team.playerStats[player.id];
                    let gamePlayedForThisPlayer = false;

                    for(const key in current.totals) {
                        const statKey = key as keyof PlayerStats;
                        const statValue = gameStats[statKey] || 0;
                        if (statValue > 0) gamePlayedForThisPlayer = true;
                        current.totals[statKey] += statValue;
                    }
                    
                    const totalMinutes = Object.values(gameStats).some(val => val > 0);

                    if(totalMinutes) {
                        current.gamesPlayed += 1;
                    }
                });
            };
            processTeam(game.homeTeam, 'homeTeam');
            processTeam(game.awayTeam, 'awayTeam');
        });

        const aggregatedList: AggregatedPlayerStats[] = Array.from(playerStatsMap.values()).map(data => ({
            ...data.playerInfo,
            teamId: data.teamId,
            teamName: data.teamName,
            gamesPlayed: data.gamesPlayed,
            totals: data.totals,
            averages: calculateAverages(data.totals, data.gamesPlayed),
        }));

        setStats(aggregatedList);
    }, [games, teams]);

     const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev.key === key && prev.direction === 'desc') {
                return { key, direction: 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const sortedAndFilteredStats = useMemo(() => {
        let filtered = [...stats];

        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (teamFilter !== 'all') {
            filtered = filtered.filter(p => p.teamId === teamFilter);
        }

        if (positionFilter !== 'all') {
            filtered = filtered.filter(p => p.position === positionFilter);
        }

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aValue: any;
                let bValue: any;
                
                if (['PPG', 'RPG', 'APG', 'SPG', 'BPG'].includes(sortConfig.key)) {
                    aValue = a.averages[sortConfig.key as keyof AggregatedPlayerStats['averages']];
                    bValue = b.averages[sortConfig.key as keyof AggregatedPlayerStats['averages']];
                } else if (sortConfig.key === 'name') {
                     aValue = a.name;
                     bValue = b.name;
                } else if (sortConfig.key === 'gamesPlayed') {
                    aValue = a.gamesPlayed;
                    bValue = b.gamesPlayed;
                }
                else {
                    const key = sortConfig.key as keyof PlayerStats;
                    aValue = a.totals[key];
                    bValue = b.totals[key];
                }
                
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        return filtered;
    }, [stats, searchTerm, teamFilter, positionFilter, sortConfig]);

    const statColumns: { label: string; key: SortKey; type: 'avg' | 'total' }[] = [
        { label: 'PPG', key: 'PPG', type: 'avg' },
        { label: 'RPG', key: 'RPG', type: 'avg' },
        { label: 'APG', key: 'APG', type: 'avg' },
        { label: 'SPG', key: 'SPG', type: 'avg' },
        { label: 'BPG', key: 'BPG', type: 'avg' },
        { label: 'PTS', key: 'PTS', type: 'total' },
        { label: 'REB', key: 'REB', type: 'total' },
        { label: 'AST', key: 'AST', type: 'total' },
        { label: 'STL', key: 'STL', type: 'total' },
        { label: 'BLK', key: 'BLK', type: 'total' },
        { label: 'PF', key: 'PF', type: 'total' },
    ];

    const SortableHeader = ({ label, columnKey }: { label: string, columnKey: SortKey }) => (
        <TableHead className="text-center cursor-pointer" onClick={() => handleSort(columnKey)}>
            <div className="flex items-center justify-center gap-1">
                {label}
                <ArrowUpDown className={cn("h-3 w-3", sortConfig.key === columnKey ? "text-foreground" : "text-muted-foreground/50")} />
            </div>
        </TableHead>
    );

    if (games.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>No hay estadísticas de jugadores</CardTitle>
                    <CardDescription>
                       No se han completado partidos en este torneo. ¡Juega algunos partidos para ver los líderes aquí!
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
         <Card>
            <CardHeader>
                <CardTitle>Líderes del Torneo</CardTitle>
                 <CardDescription>Haz clic en las cabeceras para ordenar.</CardDescription>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar jugador..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                     <Select value={teamFilter} onValueChange={setTeamFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por equipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los Equipos</SelectItem>
                            {teams.map(team => (
                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select value={positionFilter} onValueChange={setPositionFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por posición" />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="all">Todas las Posiciones</SelectItem>
                            {availablePositions.map(pos => (
                                <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 bg-card z-10 min-w-[200px] cursor-pointer" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1">
                                        Jugador
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig.key === 'name' ? "text-foreground" : "text-muted-foreground/50")} />
                                    </div>
                                </TableHead>
                                <TableHead className="text-center cursor-pointer" onClick={() => handleSort('gamesPlayed')}>
                                    <div className="flex items-center justify-center gap-1">
                                        PJ
                                        <ArrowUpDown className={cn("h-3 w-3", sortConfig.key === 'gamesPlayed' ? "text-foreground" : "text-muted-foreground/50")} />
                                    </div>
                                </TableHead>
                                {statColumns.map(col => <SortableHeader key={col.key} label={col.label} columnKey={col.key} />)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredStats.map(player => (
                                <TableRow key={player.id}>
                                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                                        <div className="font-semibold">#{player.number || '-'} {player.name}</div>
                                        <div className="text-xs text-muted-foreground">{player.teamName}</div>
                                    </TableCell>
                                    <TableCell className="text-center">{player.gamesPlayed}</TableCell>
                                    {statColumns.map(col => (
                                        <TableCell key={col.key} className="text-center">
                                            {col.type === 'avg' ? player.averages[col.key as keyof typeof player.averages] : player.totals[col.key as keyof PlayerStats]}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                            {sortedAndFilteredStats.length === 0 && (
                                    <TableRow>
                                    <TableCell colSpan={statColumns.length + 2} className="h-24 text-center">
                                        No se encontraron jugadores con los filtros actuales.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

function TournamentDetailsContent() {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [tournamentGames, setTournamentGames] = useState<Game[]>([]);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isResumingGame, setIsResumingGame] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (typeof window === 'undefined') {
                setIsLoading(false);
                return;
            }

            const tournamentId = searchParams.get('tournamentId');
            if (!tournamentId) {
                router.push('/tournaments');
                return;
            }
            
            try {
                const foundTournament = await getTournamentById(tournamentId);
                
                if (foundTournament) {
                    setTournament(foundTournament);
                    const allGames = await getFinishedGames();
                    const gamesForTournament = allGames.filter(g => g.tournamentId === tournamentId).sort((a,b) => b.date - a.date);
                    setTournamentGames(gamesForTournament);
                } else {
                    toast({ variant: 'destructive', title: 'Torneo no encontrado' });
                    router.push('/tournaments');
                }
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error al cargar datos del torneo' });
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [searchParams, router, toast]);

     const updateTournament = async (updatedTournament: Tournament) => {
        setTournament(updatedTournament);
        await saveTournament(updatedTournament);
    };
    
    const handleDeleteTournament = async () => {
        if (!tournament) return;
        
        await deleteTournamentFromDb(tournament.id);

        toast({
            title: "Torneo Eliminado",
            description: `El torneo "${tournament.name}" ha sido eliminado.`,
            variant: 'destructive'
        });
        router.push('/tournaments');
    };

    const handleResumeTournamentGame = async (gameToResume: Game) => {
        setIsResumingGame(true);
        // Remove game from general history
        await deleteFinishedGames([gameToResume.id]);
        
        // Update local state to reflect removal
        setTournamentGames(prev => prev.filter(g => g.id !== gameToResume.id));

        // Set as live game
        await saveLiveGame(gameToResume);
        
        router.push('/game/live');

        toast({
            title: "Partido Reanudado",
            description: "Se ha cargado el partido en la pantalla de juego en vivo."
        });
    };

    if (isLoading) {
        return <LoadingModal />;
    }

    if (isResumingGame) {
        return <LoadingModal text="Reanudando partido..." />;
    }

    if (!tournament) {
        return (
             <div className="container mx-auto px-4 py-8">
                <p>Torneo no encontrado. Redirigiendo...</p>
             </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
             <div className="mb-6">
                <Button asChild variant="ghost" className="mb-4 pl-0">
                    <Link href="/tournaments">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Torneos
                    </Link>
                </Button>
                 <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                             <div>
                                <CardTitle className="text-2xl md:text-3xl">{tournament.name}</CardTitle>
                                <CardDescription>{tournament.teams.length} equipos participantes</CardDescription>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar Torneo
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente el torneo. Los partidos jugados permanecerán en el historial general.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteTournament}>Sí, eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            <Tabs defaultValue="standings" className="w-full">
                 <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="standings">Tabla</TabsTrigger>
                    <TabsTrigger value="schedule">Calendario</TabsTrigger>
                    <TabsTrigger value="stats">Estadísticas</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                </TabsList>
                 <TabsContent value="standings">
                    <StandingsTable teams={tournament.teams} matches={tournament.matches} />
                </TabsContent>
                <TabsContent value="schedule">
                    <Schedule tournament={tournament} onUpdate={updateTournament} />
                </TabsContent>
                 <TabsContent value="stats">
                    <StatsTab games={tournamentGames} teams={tournament.teams} />
                </TabsContent>
                <TabsContent value="history">
                    <HistoryTab games={tournamentGames} onResumeGame={handleResumeTournamentGame} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function TournamentDetailsPage() {
    return (
        <Suspense fallback={<div className="container mx-auto px-4 py-8"><p>Cargando...</p></div>}>
            <TournamentDetailsContent />
        </Suspense>
    )
}

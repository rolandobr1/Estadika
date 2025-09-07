

'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { produce } from 'immer';
import type { Tournament, TournamentTeam, TournamentMatch, Game, GameSettings, TeamInGame, PlayerStats, Player, AggregatedPlayerStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Play, Trash2, Wand2, ChevronsRight, RotateCw, PlusCircle, Search, ArrowUpDown, RotateCcw, BarChart as BarChartIcon, Download, FileJson, FileText, Crown, Star, Users } from 'lucide-react';
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
import { createInitialPlayerStats, createInitialGame, calculateEfficiency } from '@/lib/game-utils';
import { exportBoxScoreToCsv, exportGameToJson, exportPlayByPlayToCsv, exportTournamentLeadersToCsv } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/layout/auth-provider';
import { Separator } from '@/components/ui/separator';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts';


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


const Schedule = ({ tournament, onUpdate, onResumeGame }: { tournament: Tournament, onUpdate: (updatedTournament: Tournament) => void, onResumeGame: (game: Game) => void }) => {
    const { toast } = useToast();
    const router = useRouter();
    const [showGameInProgressDialog, setShowGameInProgressDialog] = useState(false);
    const [liveGameInfo, setLiveGameInfo] = useState<{id: string, tournamentId?: string, matchId?: string} | null | undefined>(undefined);
    const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);
    const [isStartingMatch, setIsStartingMatch] = useState(false);
     const [finishedGames, setFinishedGames] = useState<Game[]>([]);


    useEffect(() => {
        const checkLiveGame = async () => {
            if (typeof window === 'undefined') return;
            const liveGameData = await getLiveGame();
            setLiveGameInfo(liveGameData);
        };
        const loadFinishedGames = async () => {
            if (typeof window === 'undefined') return;
            const allGames = await getFinishedGames();
            setFinishedGames(allGames);
        };


        checkLiveGame();
        loadFinishedGames();
        const interval = setInterval(checkLiveGame, 2000); 
        return () => {
            clearInterval(interval);
        };
    }, []);

    const getTeamName = (teamId: string) => tournament.teams.find(t => t.id === teamId)?.name || 'Equipo no encontrado';
    
    const regularSeasonMatches = tournament.matches.filter(m => m.stage === 'regular-season');
    const finalMatches = tournament.matches.filter(m => m.stage === 'final');
    
    const allRegularSeasonFinished = regularSeasonMatches.length > 0 && regularSeasonMatches.every(m => m.status === 'FINISHED');

    const handleGoToLiveGame = () => {
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
                foulsByQuarter: Array(gameSettings.quarters + 20).fill(0),
                inBonus: false,
            },
            playerStats: tournTeam.players.reduce((acc, player) => {
                acc[player.id] = createInitialPlayerStats();
                return acc;
            }, {} as Record<string, PlayerStats>),
            playersOnCourt: tournTeam.players.slice(0, 5).map(p => p.id),
            fouledOutPlayers: [],
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
        const finishedGame = finishedGames.find(g => g.id === match.gameId);

        if (match.status === 'FINISHED' && finishedGame) {
             return (
                <div className="flex items-center gap-2">
                    <div className="text-center">
                        <p className="font-bold text-lg">{match.team1.score} - {match.team2.score}</p>
                        <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs">
                            <Link href={`/history?gameId=${match.gameId}&tournamentId=${tournament.id}`}>Ver Resumen</Link>
                        </Button>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-8 w-8">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Reanudar este partido?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    El partido se cargará como el partido en vivo y se eliminará del historial para evitar duplicados. Podrás volver a guardarlo cuando termines.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onResumeGame(finishedGame)}>Sí, Reanudar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            );
        }
        
        if (isMatchInProgress) {
            return (
                 <Button size="sm" onClick={handleGoToLiveGame}>
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
                        <AlertDialogAction onClick={handleGoToLiveGame}>Ir al Partido Actual</AlertDialogAction>
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

const HistoryTab = ({ games, onResumeGame, onDeleteGame, onExport, isGuest }: { 
    games: Game[], 
    onResumeGame: (game: Game) => void,
    onDeleteGame: (gameId: string) => void,
    onExport: (game: Game, format: 'csv-box' | 'csv-pbp' | 'json') => void,
    isGuest: boolean,
}) => {
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
             <div className="space-y-0 divide-y">
                {games.map((game) => (
                    <div key={game.id} className="p-4 grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
                            <div className="text-right">
                                <p className="font-bold text-lg truncate">{game.homeTeam.name}</p>
                                <p className="font-medium text-sm text-muted-foreground">{game.homeTeam.stats.score}</p>
                            </div>
                            <p className="text-muted-foreground text-sm font-semibold">VS</p>
                            <div className="text-left">
                                <p className="font-bold text-lg truncate">{game.awayTeam.name}</p>
                                <p className="font-medium text-sm text-muted-foreground">{game.awayTeam.stats.score}</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Download className="h-4 w-4 mr-2" /> Exportar
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => onExport(game, 'csv-box')}>
                                        <BarChartIcon className="mr-2 h-4 w-4" /> Box Score (CSV)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onExport(game, 'csv-pbp')}>
                                        <FileText className="mr-2 h-4 w-4" /> Play-by-Play (CSV)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onExport(game, 'json')}>
                                        <FileJson className="mr-2 h-4 w-4" /> Archivo del Partido (JSON)
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                     <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isGuest}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar este partido?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción eliminará el partido de forma permanente. No se puede deshacer.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteGame(game.id)}>Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                  ))}
              </div>
        </div>
    );
};


type SortKey = keyof AggregatedPlayerStats['totals'] | 'name' | 'gamesPlayed' | 'PPG' | 'RPG' | 'APG' | 'SPG' | 'BPG' | 'efficiency';

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

const MVPCard = ({ player, rank }: { player: AggregatedPlayerStats, rank: number }) => {
    const rankColors = {
        1: "bg-gradient-to-br from-yellow-400 to-amber-500 border-amber-500",
        2: "bg-gradient-to-br from-slate-400 to-gray-500 border-gray-500",
        3: "bg-gradient-to-br from-orange-500 to-amber-600 border-amber-600",
    };
    const rankText = {
        1: "1º",
        2: "2º",
        3: "3º",
    };

    return (
        <Card className="relative overflow-hidden shadow-lg border-2 border-transparent">
             <div className={`absolute top-0 right-0 text-white font-bold text-xs px-3 py-1 rounded-bl-lg ${rankColors[rank as keyof typeof rankColors]}`}>
                {rankText[rank as keyof typeof rankText]}
            </div>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <div className="flex flex-col h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-bold mb-3">
                    <span className="text-xs font-semibold -mb-1">EFF</span>
                    <span className="text-4xl">{player.efficiency}</span>
                </div>
                <p className="font-bold text-lg truncate w-full">{player.name} <span className="font-normal text-muted-foreground">#{player.number}</span></p>
                <p className="text-sm text-muted-foreground truncate w-full">{player.teamName}</p>
                <Separator className="my-3" />
                <div className="grid grid-cols-3 gap-2 text-xs w-full">
                    <div>
                        <p className="font-bold text-base">{player.averages.PPG}</p>
                        <p className="text-muted-foreground">PTS</p>
                    </div>
                     <div>
                        <p className="font-bold text-base">{player.averages.RPG}</p>
                        <p className="text-muted-foreground">REB</p>
                    </div>
                     <div>
                        <p className="font-bold text-base">{player.averages.APG}</p>
                        <p className="text-muted-foreground">AST</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


const PlayerComparison = ({ player1, player2 }: { player1: AggregatedPlayerStats, player2: AggregatedPlayerStats }) => {
    const comparisonData = [
        { name: 'Puntos', [player1.name]: player1.averages.PPG, [player2.name]: player2.averages.PPG },
        { name: 'Rebotes', [player1.name]: player1.averages.RPG, [player2.name]: player2.averages.RPG },
        { name: 'Asist.', [player1.name]: player1.averages.APG, [player2.name]: player2.averages.APG },
        { name: 'Robos', [player1.name]: player1.averages.SPG, [player2.name]: player2.averages.SPG },
        { name: 'Tapones', [player1.name]: player1.averages.BPG, [player2.name]: player2.averages.BPG },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cara a Cara: {player1.name} vs {player2.name}</CardTitle>
                <CardDescription>Comparación de promedios por partido.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                     <BarChart data={comparisonData} layout="vertical" barSize={25} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={70} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Bar dataKey={player1.name} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey={player1.name} position="right" className="fill-foreground font-semibold" />
                        </Bar>
                        <Bar dataKey={player2.name} fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]}>
                             <LabelList dataKey={player2.name} position="right" className="fill-foreground font-semibold" />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

const TeamComparisonChart = ({ team1, team2 }: { team1: TournamentTeam & { gamesPlayed: number }, team2: TournamentTeam & { gamesPlayed: number }}) => {
    
    const calculateAverages = (team: TournamentTeam & { gamesPlayed: number }) => {
        if (team.gamesPlayed === 0) {
            return { PPG: 0, PAPG: 0 };
        }
        return {
            PPG: parseFloat((team.pointsFor / team.gamesPlayed).toFixed(1)),
            PAPG: parseFloat((team.pointsAgainst / team.gamesPlayed).toFixed(1)),
        };
    };

    const team1Averages = calculateAverages(team1);
    const team2Averages = calculateAverages(team2);

    const comparisonData = [
        { name: 'Puntos a Favor', [team1.name]: team1Averages.PPG, [team2.name]: team2Averages.PPG },
        { name: 'Puntos en Contra', [team1.name]: team1Averages.PAPG, [team2.name]: team2Averages.PAPG },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cara a Cara: {team1.name} vs {team2.name}</CardTitle>
                <CardDescription>Comparación de promedios por partido.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                     <BarChart data={comparisonData} layout="vertical" barSize={25} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Bar dataKey={team1.name} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey={team1.name} position="right" className="fill-foreground font-semibold" />
                        </Bar>
                        <Bar dataKey={team2.name} fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]}>
                             <LabelList dataKey={team2.name} position="right" className="fill-foreground font-semibold" />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

const StatsTab = ({ games, teams }: { games: Game[], teams: TournamentTeam[] }) => {
    const [stats, setStats] = useState<AggregatedPlayerStats[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'efficiency', direction: 'desc' });
    const [teamFilter, setTeamFilter] = useState('all');
    const [positionFilter, setPositionFilter] = useState('all');
    const [leaderStatFilter, setLeaderStatFilter] = useState('all');

    // For player comparison
    const [player1Id, setPlayer1Id] = useState<string | null>(null);
    const [player2Id, setPlayer2Id] = useState<string | null>(null);

    // For team comparison
    const [team1Id, setTeam1Id] = useState<string | null>(null);
    const [team2Id, setTeam2Id] = useState<string | null>(null);
    
    type TeamSortKey = keyof PlayerStats | 'name' | 'gamesPlayed';
    type TeamStatColumnKey = keyof PlayerStats;

    const [teamSortConfig, setTeamSortConfig] = useState<{ key: TeamSortKey, direction: 'asc' | 'desc' }>({ key: 'PTS', direction: 'desc' });
    
    const aggregatedTeamStats = useMemo(() => {
        const teamStatsMap = new Map<string, { totals: PlayerStats, gamesPlayed: number }>();

        teams.forEach(team => {
            teamStatsMap.set(team.id, { totals: createInitialPlayerStats(), gamesPlayed: 0 });
        });

        games.forEach(game => {
            const processTeam = (teamInGame: TeamInGame, teamInfo: TournamentTeam | undefined) => {
                if (!teamInfo || !teamStatsMap.has(teamInfo.id)) return;
                
                const current = teamStatsMap.get(teamInfo.id)!;
                current.gamesPlayed += 1;

                Object.values(teamInGame.playerStats).forEach(playerGameStats => {
                    for (const key in current.totals) {
                        const statKey = key as keyof PlayerStats;
                        current.totals[statKey] += playerGameStats[statKey] || 0;
                    }
                });
            };
            
            // Find team info by ID, which is more robust than by name
            const homeTeamInfo = teams.find(t => t.id === game.homeTeam.id || t.name === game.homeTeam.name);
            const awayTeamInfo = teams.find(t => t.id === game.awayTeam.id || t.name === game.awayTeam.name);

            if (homeTeamInfo) processTeam(game.homeTeam, homeTeamInfo);
            if (awayTeamInfo) processTeam(game.awayTeam, awayTeamInfo);
        });

        return teams.map(team => ({
            ...team,
            ...(teamStatsMap.get(team.id)!),
        }));

    }, [games, teams]);

    const sortedTeamStats = useMemo(() => {
        return [...aggregatedTeamStats].sort((a, b) => {
            let aValue, bValue;
            if(teamSortConfig.key === 'name') {
                aValue = a.name;
                bValue = b.name;
            } else if (teamSortConfig.key === 'gamesPlayed') {
                aValue = a.gamesPlayed;
                bValue = b.gamesPlayed;
            } else {
                aValue = a.totals[teamSortConfig.key as keyof PlayerStats];
                bValue = b.totals[teamSortConfig.key as keyof PlayerStats];
            }

            if (aValue < bValue) return teamSortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return teamSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [aggregatedTeamStats, teamSortConfig]);

    const handleTeamSort = (key: TeamSortKey) => {
        setTeamSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };


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
            const processTeam = (teamInGame: TeamInGame) => {
                 const tournamentTeam = teams.find(t => t.name === teamInGame.name);
                 if (!tournamentTeam) return;

                Object.keys(teamInGame.playerStats).forEach(playerId => {
                    const gameStats = teamInGame.playerStats[playerId];
                    const playerInMap = playerStatsMap.get(playerId);
                    
                    if (playerInMap) {
                        let gamePlayedForThisPlayer = false;
                        for(const key in playerInMap.totals) {
                            const statKey = key as keyof PlayerStats;
                            const statValue = gameStats[statKey] || 0;
                            if (statValue > 0) gamePlayedForThisPlayer = true;
                            playerInMap.totals[statKey] += statValue;
                        }

                        if(Object.values(gameStats).some(val => val > 0)) {
                             playerInMap.gamesPlayed += 1;
                        }
                    }
                });
            };
            processTeam(game.homeTeam);
            processTeam(game.awayTeam);
        });

        const aggregatedList: AggregatedPlayerStats[] = Array.from(playerStatsMap.values()).map(data => ({
            ...data.playerInfo,
            teamId: data.teamId,
            teamName: data.teamName,
            gamesPlayed: data.gamesPlayed,
            totals: data.totals,
            averages: calculateAverages(data.totals, data.gamesPlayed),
            efficiency: calculateEfficiency(data.totals),
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
        
        const sortKey = leaderStatFilter !== 'all' ? leaderStatFilter as SortKey : sortConfig.key;
        const sortDirection = leaderStatFilter !== 'all' ? 'desc' : sortConfig.direction;

        if (sortKey) {
            filtered.sort((a, b) => {
                let aValue: any;
                let bValue: any;
                
                if (['PPG', 'RPG', 'APG', 'SPG', 'BPG'].includes(sortKey)) {
                    aValue = a.averages[sortKey as keyof AggregatedPlayerStats['averages']];
                    bValue = b.averages[sortKey as keyof AggregatedPlayerStats['averages']];
                } else if (sortKey === 'name') {
                     aValue = a.name;
                     bValue = b.name;
                } else if (sortKey === 'gamesPlayed' || sortKey === 'efficiency') {
                    aValue = a[sortKey];
                    bValue = b[sortKey];
                }
                else {
                    const key = sortKey as keyof PlayerStats;
                    aValue = a.totals[key];
                    bValue = b.totals[key];
                }
                
                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        return filtered;
    }, [stats, searchTerm, teamFilter, positionFilter, sortConfig, leaderStatFilter]);

    const mvpCandidates = useMemo(() => {
        return [...stats]
            .sort((a, b) => (b.efficiency ?? 0) - (a.efficiency ?? 0))
            .slice(0, 3);
    }, [stats]);


    const statColumns: { label: string; key: SortKey; type: 'avg' | 'total' | 'eff' }[] = [
        { label: 'EFF', key: 'efficiency', type: 'eff' },
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
        { label: 'FP', key: 'PF', type: 'total' },
    ];
    
    const leaderStatOptions = [
        { label: 'Eficiencia', key: 'efficiency', totalKey: 'efficiency' },
        { label: 'Puntos', key: 'PPG', totalKey: 'PTS' },
        { label: 'Rebotes', key: 'RPG', totalKey: 'REB' },
        { label: 'Asistencias', key: 'APG', totalKey: 'AST' },
        { label: 'Robos', key: 'SPG', totalKey: 'STL' },
        { label: 'Tapones', key: 'BPG', totalKey: 'BLK' },
    ];

    const comparisonPlayer1 = useMemo(() => stats.find(p => p.id === player1Id), [stats, player1Id]);
    const comparisonPlayer2 = useMemo(() => stats.find(p => p.id === player2Id), [stats, player2Id]);

    const teamsWithGamesPlayed = useMemo(() => {
        return teams.map(team => {
            const gamesPlayed = games.filter(g => g.homeTeam.name === team.name || g.awayTeam.name === team.name).length;
            const teamStats = aggregatedTeamStats.find(ts => ts.id === team.id);
            return { ...team, gamesPlayed, ...(teamStats?.totals && { pointsFor: teamStats.totals.PTS }) };
        });
    }, [teams, games, aggregatedTeamStats]);

    const comparisonTeam1 = useMemo(() => teamsWithGamesPlayed.find(t => t.id === team1Id), [teamsWithGamesPlayed, team1Id]);
    const comparisonTeam2 = useMemo(() => teamsWithGamesPlayed.find(t => t.id === team2Id), [teamsWithGamesPlayed, team2Id]);

    const SortableHeader = ({ label, columnKey, action, currentSortKey, currentSortDir }: { label: string, columnKey: string, action: (key: any) => void, currentSortKey: string, currentSortDir: string }) => (
        <TableHead className="text-center cursor-pointer" onClick={() => action(columnKey)}>
            <div className="flex items-center justify-center gap-1">
                {label}
                <ArrowUpDown className={cn("h-3 w-3", currentSortKey === columnKey ? "text-foreground" : "text-muted-foreground/50")} />
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

    const renderLeaderTableContent = () => {
        const selectedLeaderOption = leaderStatOptions.find(opt => opt.key === leaderStatFilter);
        
        return sortedAndFilteredStats.map(player => (
            <TableRow key={player.id}>
                <TableCell className="font-medium sticky left-0 bg-card z-10">
                    <div className="font-semibold">#{player.number || '-'} {player.name}</div>
                    <div className="text-xs text-muted-foreground">{player.teamName}</div>
                </TableCell>
                <TableCell className="text-center">{player.gamesPlayed}</TableCell>
                
                {leaderStatFilter === 'all' ? (
                    statColumns.map(col => (
                        <TableCell key={col.key} className="text-center">
                            {col.type === 'avg' ? player.averages[col.key as keyof typeof player.averages] 
                            : col.type === 'eff' ? player.efficiency
                            : player.totals[col.key as keyof PlayerStats]}
                        </TableCell>
                    ))
                ) : (
                    <>
                        <TableCell className="text-center font-bold">
                            {leaderStatFilter === 'efficiency' ? player.efficiency : player.averages[leaderStatFilter as keyof typeof player.averages]}
                        </TableCell>
                        {selectedLeaderOption && selectedLeaderOption.key !== 'efficiency' && (
                             <TableCell className="text-center">
                                {player.totals[selectedLeaderOption.totalKey as keyof PlayerStats]}
                             </TableCell>
                        )}
                    </>
                )}
            </TableRow>
        ));
    };

    const teamStatColumns: { label: string, key: TeamStatColumnKey }[] = [
        { label: 'Puntos', key: 'PTS' },
        { label: 'Rebotes', key: 'REB' },
        { label: 'Asistencias', key: 'AST' },
        { label: 'Robos', key: 'STL' },
        { label: 'Tapones', key: 'BLK' },
        { label: 'Pérdidas', key: 'TOV' },
        { label: 'Faltas', key: 'PF' },
    ];


    return (
        <div className="space-y-6">
            <div>
                 <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2">
                    <Star className="h-6 w-6 text-yellow-500" />
                    Carrera por el MVP
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {mvpCandidates.map((player, index) => (
                        <MVPCard key={player.id} player={player} rank={index + 1} />
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    Estadísticas de Equipo
                </h2>
                 <Tabs defaultValue="head-to-head">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="head-to-head">Cara a Cara</TabsTrigger>
                        <TabsTrigger value="totals">Totales del Torneo</TabsTrigger>
                    </TabsList>
                    <TabsContent value="head-to-head" className="mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select onValueChange={setTeam1Id} value={team1Id ?? undefined}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar Equipo 1" /></SelectTrigger>
                                <SelectContent>
                                    {teams.map(t => <SelectItem key={t.id} value={t.id} disabled={t.id === team2Id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select onValueChange={setTeam2Id} value={team2Id ?? undefined}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar Equipo 2" /></SelectTrigger>
                                <SelectContent>
                                    {teams.map(t => <SelectItem key={t.id} value={t.id} disabled={t.id === team1Id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {comparisonTeam1 && comparisonTeam2 && (
                            <div className="mt-4">
                                <TeamComparisonChart team1={comparisonTeam1} team2={comparisonTeam2} />
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="totals" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Estadísticas Totales por Equipo</CardTitle>
                                <CardDescription>Datos acumulados de todos los partidos del torneo.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <SortableHeader label="Equipo" columnKey="name" action={handleTeamSort} currentSortKey={teamSortConfig.key} currentSortDir={teamSortConfig.direction} />
                                                <SortableHeader label="PJ" columnKey="gamesPlayed" action={handleTeamSort} currentSortKey={teamSortConfig.key} currentSortDir={teamSortConfig.direction} />
                                                {teamStatColumns.map(col => (
                                                    <SortableHeader key={col.key} label={col.label} columnKey={col.key} action={() => handleTeamSort(col.key)} currentSortKey={teamSortConfig.key} currentSortDir={teamSortConfig.direction} />
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedTeamStats.map(team => (
                                                <TableRow key={team.id}>
                                                    <TableCell className="font-semibold">{team.name}</TableCell>
                                                    <TableCell className="text-center">{team.gamesPlayed}</TableCell>
                                                    {teamStatColumns.map(col => (
                                                        <TableCell key={col.key} className="text-center">{team.totals[col.key]}</TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    Comparación de Jugadores
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select onValueChange={setPlayer1Id} value={player1Id ?? undefined}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar Jugador 1" /></SelectTrigger>
                        <SelectContent>
                            {stats.map(p => <SelectItem key={p.id} value={p.id} disabled={p.id === player2Id}>#{p.number} {p.name} ({p.teamName})</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select onValueChange={setPlayer2Id} value={player2Id ?? undefined}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar Jugador 2" /></SelectTrigger>
                        <SelectContent>
                            {stats.map(p => <SelectItem key={p.id} value={p.id} disabled={p.id === player1Id}>#{p.number} {p.name} ({p.teamName})</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {comparisonPlayer1 && comparisonPlayer2 && (
                    <PlayerComparison player1={comparisonPlayer1} player2={comparisonPlayer2} />
                )}
            </div>


             <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Líderes del Torneo</CardTitle>
                            <CardDescription>Usa los filtros para explorar las estadísticas de los jugadores.</CardDescription>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => exportTournamentLeadersToCsv(sortedAndFilteredStats)}
                            disabled={sortedAndFilteredStats.length === 0}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Exportar (CSV)
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4">
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
                         <Select value={leaderStatFilter} onValueChange={setLeaderStatFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Líder por estadística" />
                            </SelectTrigger>
                            <SelectContent>
                                 <SelectItem value="all">Ver todas las estadísticas</SelectItem>
                                {leaderStatOptions.map(opt => (
                                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
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
                                    <SortableHeader label="Jugador" columnKey="name" action={handleSort} currentSortKey={sortConfig.key} currentSortDir={sortConfig.direction} />
                                    <SortableHeader label="PJ" columnKey="gamesPlayed" action={handleSort} currentSortKey={sortConfig.key} currentSortDir={sortConfig.direction} />
                                    {leaderStatFilter === 'all' ? (
                                        statColumns.map(col => <SortableHeader key={col.key} label={col.label} columnKey={col.key} action={handleSort} currentSortKey={sortConfig.key} currentSortDir={sortConfig.direction} />)
                                    ) : (
                                        <>
                                            <SortableHeader 
                                                label={leaderStatOptions.find(opt => opt.key === leaderStatFilter)?.label || 'Valor'} 
                                                columnKey={leaderStatFilter as SortKey} 
                                                action={handleSort}
                                                currentSortKey={sortConfig.key}
                                                currentSortDir={sortConfig.direction}
                                            />
                                            {leaderStatFilter !== 'efficiency' && (
                                                <SortableHeader 
                                                    label="Total"
                                                    columnKey={leaderStatOptions.find(opt => opt.key === leaderStatFilter)?.totalKey as SortKey}
                                                    action={handleSort}
                                                    currentSortKey={sortConfig.key}
                                                    currentSortDir={sortConfig.direction}
                                                />
                                            )}
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                               {sortedAndFilteredStats.length > 0 ? (
                                    renderLeaderTableContent()
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={leaderStatFilter === 'all' ? statColumns.length + 2 : (leaderStatFilter === 'efficiency' ? 3 : 4)} className="h-24 text-center">
                                            No se encontraron jugadores con los filtros actuales.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

function TournamentDetailsContent() {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [tournamentGames, setTournamentGames] = useState<Game[]>([]);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const { user } = useAuth();
    const isGuest = user?.isAnonymous;

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
                    const gamesForTournament = allGames.filter(g => g.tournamentId === tournamentId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

    const handleResumeGame = async (gameToResume: Game) => {
        setIsProcessing(true);
        const existingLiveGame = await getLiveGame();
        if (existingLiveGame) {
             toast({
                title: "Juego en Curso",
                description: "Ya hay un partido en progreso. Finalízalo antes de reanudar otro.",
                variant: "destructive",
            });
            setIsProcessing(false);
            return;
        }

        // Remove game from general history
        await deleteFinishedGames([gameToResume.id]);
        
        // Update local state to reflect removal
        setTournamentGames(prev => prev.filter(g => g.id !== gameToResume.id));

        if (tournament) {
            const updatedTournament = produce(tournament, draft => {
                const matchIndex = draft.matches.findIndex(m => m.id === gameToResume.matchId);
                if (matchIndex > -1) {
                    draft.matches[matchIndex].status = 'IN_PROGRESS';
                    draft.matches[matchIndex].gameId = undefined;
                    draft.matches[matchIndex].team1.score = undefined;
                    draft.matches[matchIndex].team2.score = undefined;
                }
            });
            await updateTournament(updatedTournament);
        }

        // Set as live game
        await saveLiveGame(gameToResume);
        
        router.push('/game/live');

        toast({
            title: "Partido Reanudado",
            description: "Se ha cargado el partido en la pantalla de juego en vivo."
        });
    };
    
    const handleDeleteGame = async (gameId: string) => {
        setIsProcessing(true);
        await deleteFinishedGames([gameId]);
        setTournamentGames(prev => prev.filter(g => g.id !== gameId));

         if (tournament) {
            const updatedTournament = produce(tournament, draft => {
                const matchIndex = draft.matches.findIndex(m => m.gameId === gameId);
                if (matchIndex > -1) {
                    draft.matches[matchIndex].status = 'PENDING';
                    draft.matches[matchIndex].gameId = undefined;
                    draft.matches[matchIndex].team1.score = undefined;
                    draft.matches[matchIndex].team2.score = undefined;
                }
            });
            await updateTournament(updatedTournament);
        }

        toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del historial.' });
        setIsProcessing(false);
    };
    
    const handleExport = (game: Game, format: 'csv-box' | 'csv-pbp' | 'json') => {
        let title = '';
        if (format === 'csv-box') {
            exportBoxScoreToCsv(game);
            title = 'Box Score Exportado';
        } else if (format === 'csv-pbp') {
            exportPlayByPlayToCsv(game);
            title = 'Play-by-Play Exportado';
        } else if (format === 'json') {
            exportGameToJson(game);
            title = 'Archivo del Partido Exportado';
        }
        toast({
            title: title,
            description: 'El archivo se ha guardado en tu dispositivo.',
        });
    };

    if (isLoading) {
        return <LoadingModal />;
    }

    if (isProcessing) {
        return <LoadingModal text="Procesando..." />;
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
                                    <Button variant="destructive" size="sm" disabled={isGuest}>
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
                    <Schedule tournament={tournament} onUpdate={updateTournament} onResumeGame={handleResumeGame} />
                </TabsContent>
                 <TabsContent value="stats">
                    <StatsTab games={tournamentGames} teams={tournament.teams} />
                </TabsContent>
                <TabsContent value="history">
                    <HistoryTab 
                        games={tournamentGames} 
                        onResumeGame={handleResumeGame} 
                        onDeleteGame={handleDeleteGame}
                        onExport={handleExport}
                        isGuest={isGuest || false}
                    />
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

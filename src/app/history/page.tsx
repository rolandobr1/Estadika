
'use client';
import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronsRight, Trash2, Search, ArrowLeft, RotateCcw, Upload, FileText, BarChart, FileJson, Trophy, Crown, Share2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { Game, Player, PlayerStats, TeamInGame, GameAction } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoadingModal } from '@/components/ui/loader';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFinishedGames, deleteFinishedGames, importGames, saveLiveGame, getLiveGame } from '@/lib/db';
import { exportGameToJson, exportPlayByPlayToCsv, exportBoxScoreToCsv } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/layout/auth-provider';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import * as htmlToImage from 'html-to-image';
import { ShareCard } from '@/components/share-card';
import { calculateEfficiency } from '@/lib/game-utils';


const ScoreboardByQuarter = ({ game }: { game: Game }) => {
    const calculateQuarterScores = () => {
        const quarterScores: { home: number[], away: number[] } = { home: [], away: [] };
        const numPeriods = Math.max(game.settings.quarters, game.currentQuarter);
        let lastHomeScore = 0;
        let lastAwayScore = 0;

        for (let q = 1; q <= numPeriods; q++) {
            const actionsInQuarter = game.gameLog.filter(action => action.payload.quarter === q);
            
            let homeScoreInQuarter = 0;
            let awayScoreInQuarter = 0;

            if (actionsInQuarter.length > 0) {
                const lastAction = actionsInQuarter[actionsInQuarter.length - 1];
                const cumulativeHomeScore = lastAction.payload.homeScore ?? 0;
                const cumulativeAwayScore = lastAction.payload.awayScore ?? 0;

                homeScoreInQuarter = cumulativeHomeScore - lastHomeScore;
                awayScoreInQuarter = cumulativeAwayScore - lastAwayScore;
                
                lastHomeScore = cumulativeHomeScore;
                lastAwayScore = cumulativeAwayScore;
            }
            
            quarterScores.home.push(homeScoreInQuarter);
            quarterScores.away.push(awayScoreInQuarter);
        }
        
        const totalHomeByQuarters = quarterScores.home.reduce((a, b) => a + b, 0);
        const totalAwayByQuarters = quarterScores.away.reduce((a, b) => a + b, 0);

        if (totalHomeByQuarters !== game.homeTeam.stats.score || totalAwayByQuarters !== game.awayTeam.stats.score) {
            const lastActiveQuarterIndex = game.gameLog.reduce((maxQuarter, action) => {
                const actionQuarter = action.payload.quarter ?? 0;
                if(actionQuarter > 0) return Math.max(maxQuarter, actionQuarter);
                return maxQuarter;
            }, 0) -1;

            if (lastActiveQuarterIndex >= 0) {
                 quarterScores.home[lastActiveQuarterIndex] += game.homeTeam.stats.score - totalHomeByQuarters;
                 quarterScores.away[lastActiveQuarterIndex] += game.awayTeam.stats.score - totalAwayByQuarters;
            }
        }


        return quarterScores;
    };

    const scores = calculateQuarterScores();
    const numPeriods = scores.home.length;

    const renderHeader = () => {
        const headers = [];
        const quarters = game.settings.quarters;
        for (let i = 1; i <= numPeriods; i++) {
            if (i <= quarters) {
                headers.push(<TableHead key={`q${i}`} className="text-center">{i}C</TableHead>);
            } else {
                headers.push(<TableHead key={`ot${i}`} className="text-center">PR{i - quarters}</TableHead>);
            }
        }
        headers.push(<TableHead key="total" className="text-center font-bold">TOT</TableHead>);
        return headers;
    };

    const renderRow = (teamScores: number[]) => {
        return teamScores.map((score, index) => (
            <TableCell key={`score-${index}`} className="text-center">{score}</TableCell>
        ));
    };

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[120px]">Equipo</TableHead>
                        {renderHeader()}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell className="font-semibold">{game.homeTeam.name}</TableCell>
                        {renderRow(scores.home)}
                        <TableCell className="text-center font-bold text-primary">{game.homeTeam.stats.score}</TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell className="font-semibold">{game.awayTeam.name}</TableCell>
                        {renderRow(scores.away)}
                        <TableCell className="text-center font-bold text-primary">{game.awayTeam.stats.score}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
};

const StandoutPlayerCard = ({ player, teamName }: { player: Player & { stats: PlayerStats, efficiency: number }, teamName: string }) => {
    if (!player) return null;
    
    return (
        <Card className="bg-gradient-to-br from-card to-secondary/50">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Jugador Destacado</CardTitle>
                    <Crown className="h-6 w-6 text-yellow-500" />
                </div>
                 <CardDescription>El jugador con mejor rendimiento del partido.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        <span className="text-xs -mb-1">EFF</span>
                        <span className="text-4xl">{player.efficiency}</span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold">#{player.number ?? '-'} {player.name}</h3>
                        <p className="text-lg text-muted-foreground">{teamName}</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="p-2 rounded-md bg-secondary">
                        <p className="font-bold text-xl">{player.stats.PTS}</p>
                        <p className="text-xs text-muted-foreground">Puntos</p>
                    </div>
                    <div className="p-2 rounded-md bg-secondary">
                        <p className="font-bold text-xl">{player.stats.REB}</p>
                        <p className="text-xs text-muted-foreground">Rebotes</p>
                    </div>
                     <div className="p-2 rounded-md bg-secondary">
                        <p className="font-bold text-xl">{player.stats.AST}</p>
                        <p className="text-xs text-muted-foreground">Asist.</p>
                    </div>
                    <div className="p-2 rounded-md bg-secondary">
                        <p className="font-bold text-xl">{player.stats.STL}</p>
                        <p className="text-xs text-muted-foreground">Robos</p>
                    </div>
                    <div className="p-2 rounded-md bg-secondary">
                        <p className="font-bold text-xl">{player.stats.BLK}</p>
                        <p className="text-xs text-muted-foreground">Tapones</p>
                    </div>
                    <div className="p-2 rounded-md bg-secondary">
                        <p className="font-bold text-xl">{player.stats.PF + player.stats.UF + player.stats.TF}</p>
                        <p className="text-xs text-muted-foreground">Faltas</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const TeamComparisonChart = ({ homeTeam, awayTeam }: { homeTeam: TeamInGame, awayTeam: TeamInGame }) => {
    const calculateTeamTotals = (team: TeamInGame) => {
        const totals = Object.values(team.playerStats).reduce((acc, stats) => {
            Object.keys(stats).forEach(key => {
                const statKey = key as keyof PlayerStats;
                acc[statKey] = (acc[statKey] || 0) + stats[statKey];
            });
            return acc;
        }, {} as PlayerStats);
        return totals;
    };
    
    const homeTotals = calculateTeamTotals(homeTeam);
    const awayTotals = calculateTeamTotals(awayTeam);

    const homeFouls = homeTotals.PF + homeTotals.UF + homeTotals.TF;
    const awayFouls = awayTotals.PF + awayTotals.UF + awayTotals.TF;

    const data = [
        { name: 'Rebotes', [homeTeam.name]: homeTotals.REB, [awayTeam.name]: awayTotals.REB },
        { name: 'Asist.', [homeTeam.name]: homeTotals.AST, [awayTeam.name]: awayTotals.AST },
        { name: 'Robos', [homeTeam.name]: homeTotals.STL, [awayTeam.name]: awayTotals.STL },
        { name: 'Pérdidas', [homeTeam.name]: homeTotals.TOV, [awayTeam.name]: awayTotals.TOV },
        { name: 'Faltas', [homeTeam.name]: homeFouls, [awayTeam.name]: awayFouls },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Estadísticas Comparativas</CardTitle>
                 <CardDescription>Comparación de estadísticas clave entre ambos equipos.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart data={data} layout="vertical" barSize={25} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={70} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Bar dataKey={homeTeam.name} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey={homeTeam.name} position="right" className="fill-foreground font-semibold" />
                        </Bar>
                        <Bar dataKey={awayTeam.name} fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]}>
                             <LabelList dataKey={awayTeam.name} position="right" className="fill-foreground font-semibold" />
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

const GameBoxScore = ({ game }: { game: Game }) => {

    const calculateShootingPercentage = (made: number, attempted: number): string => {
        if (attempted === 0) return '0.0%';
        return ((made / attempted) * 100).toFixed(1) + '%';
    };
    
    const standoutPlayers = useMemo(() => {
        let homeBest: (Player & { stats: PlayerStats, efficiency: number }) | null = null;
        let awayBest: (Player & { stats: PlayerStats, efficiency: number }) | null = null;
        let maxHomeEfficiency = -Infinity;
        let maxAwayEfficiency = -Infinity;

        const processTeam = (team: TeamInGame, isHome: boolean) => {
            team.players.forEach(player => {
                const stats = team.playerStats[player.id];
                if (!stats) return; // Defensive check
                const efficiency = calculateEfficiency(stats);
                
                if (isHome) {
                    if (efficiency > maxHomeEfficiency) {
                        maxHomeEfficiency = efficiency;
                        homeBest = { ...player, stats, efficiency };
                    }
                } else {
                    if (efficiency > maxAwayEfficiency) {
                        maxAwayEfficiency = efficiency;
                        awayBest = { ...player, stats, efficiency };
                    }
                }
            });
        };

        processTeam(game.homeTeam, true);
        processTeam(game.awayTeam, false);
        
        return { home: homeBest, away: awayBest };
    }, [game]);


    const TeamBoxScore = ({ team }: { team: TeamInGame }) => {
        const teamTotals = team.players.reduce((acc, player) => {
            const stats = team.playerStats[player.id];
            if (!stats) return acc;
            Object.keys(stats).forEach(key => {
                const statKey = key as keyof PlayerStats;
                acc[statKey] = (acc[statKey] || 0) + stats[statKey];
            });
            return acc;
        }, {} as PlayerStats);

        return (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[150px] text-xs sm:text-sm">Jugador</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">PTS</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">REB</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">AST</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">ROB</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">TAP</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">TC</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">TC%</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">3P</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">3P%</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">TL</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">TL%</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm">FP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {team.players.map(player => {
                             const stats = team.playerStats[player.id];
                             if (!stats) return null;
                             const fgPerc = calculateShootingPercentage(stats['2PM'] + stats['3PM'], stats['2PA'] + stats['3PA']);
                             const threePerc = calculateShootingPercentage(stats['3PM'], stats['3PA']);
                             const ftPerc = calculateShootingPercentage(stats['1PM'], stats['1PA']);

                            return (
                                <TableRow key={player.id}>
                                    <TableCell className="font-medium text-xs sm:text-sm">
                                        <span className="font-semibold">#{player.number} {player.name}</span>
                                        {player.position && <span className="text-xs text-muted-foreground block">{player.position}</span>}
                                    </TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats.PTS}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats.REB}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats.AST}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats.STL}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats.BLK}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats['2PM'] + stats['3PM']}-{stats['2PA'] + stats['3PA']}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{fgPerc}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats['3PM']}-{stats['3PA']}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{threePerc}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats['1PM']}-{stats['1PA']}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{ftPerc}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm">{stats.PF + stats.UF + stats.TF}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                     <TableFooter>
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell className="text-xs sm:text-sm">Totales del Equipo</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals.PTS}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals.REB}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals.AST}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals.STL}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals.BLK}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals['2PM'] + teamTotals['3PM']}-{teamTotals['2PA'] + teamTotals['3PA']}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{calculateShootingPercentage(teamTotals['2PM'] + teamTotals['3PM'], teamTotals['2PA'] + teamTotals['3PA'])}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals['3PM']}-{teamTotals['3PA']}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{calculateShootingPercentage(teamTotals['3PM'], teamTotals['3PA'])}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals['1PM']}-{teamTotals['1PA']}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{calculateShootingPercentage(teamTotals['1PM'], teamTotals['1PA'])}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{teamTotals.PF + teamTotals.UF + teamTotals.TF}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription className="text-center">{new Date(game.date).toLocaleString()}</CardDescription>
                    <div className="flex items-center justify-center gap-4 py-2">
                        <div className="text-right">
                             <CardTitle className="text-2xl">{game.homeTeam.name}</CardTitle>
                        </div>
                         <div className="text-4xl font-bold px-4">{game.homeTeam.stats.score} - {game.awayTeam.stats.score}</div>
                         <div>
                            <CardTitle className="text-2xl">{game.awayTeam.name}</CardTitle>
                         </div>
                    </div>
                     {game.settings.name && <p className="text-sm text-center text-muted-foreground pt-1">{game.settings.name}</p>}
                </CardHeader>
                <CardContent className="p-0">
                    <ScoreboardByQuarter game={game} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {standoutPlayers.home && <StandoutPlayerCard player={standoutPlayers.home} teamName={game.homeTeam.name} />}
                {standoutPlayers.away && <StandoutPlayerCard player={standoutPlayers.away} teamName={game.awayTeam.name} />}
            </div>

            <TeamComparisonChart homeTeam={game.homeTeam} awayTeam={game.awayTeam} />

            <Tabs defaultValue={game.homeTeam.id}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value={game.homeTeam.id}>{game.homeTeam.name}</TabsTrigger>
                    <TabsTrigger value={game.awayTeam.id}>{game.awayTeam.name}</TabsTrigger>
                </TabsList>
                <TabsContent value={game.homeTeam.id}>
                    <Card>
                        <CardContent className="p-0">
                           <TeamBoxScore team={game.homeTeam} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value={game.awayTeam.id}>
                     <Card>
                        <CardContent className="p-0">
                           <TeamBoxScore team={game.awayTeam} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

function HistoryContent() {
  const [history, setHistory] = useState<Game[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const router = useRouter();
  const importFileRef = useRef<HTMLInputElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [gameToShare, setGameToShare] = useState<Game | null>(null);

  const [isClient, setIsClient] = useState(false);
  const { user } = useAuth();
  const isGuest = user?.isAnonymous;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const searchParams = useSearchParams();
  const gameIdToShow = searchParams.get('gameId');
  const tournamentIdContext = searchParams.get('tournamentId');

  useEffect(() => {
    async function loadHistory() {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }
        
        try {
            const gamesFromDb = await getFinishedGames();
            if (gameIdToShow) {
                setHistory(gamesFromDb);
            } else {
                setHistory(gamesFromDb.sort((a: Game, b: Game) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
        } catch (error) {
            console.error("Error loading history", error);
            toast({ title: "Error", description: "No se pudo cargar el historial de partidos."});
        } finally {
            setIsLoading(false);
        }
    }
    loadHistory();
  }, [gameIdToShow, toast]);

    // Effect to generate and download image when gameToShare is set
    useEffect(() => {
        if (gameToShare && shareCardRef.current) {
            setIsSharing(true);
            htmlToImage.toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2 })
                .then((dataUrl) => {
                    const link = document.createElement('a');
                    link.download = `partido_${gameToShare.homeTeam.name}_vs_${gameToShare.awayTeam.name}.png`;
                    link.href = dataUrl;
                    link.click();
                    setGameToShare(null); // Reset after download
                })
                .catch((err) => {
                    console.error('oops, something went wrong!', err);
                    toast({
                        variant: 'destructive',
                        title: 'Error al generar imagen',
                        description: 'No se pudo crear la imagen para compartir.',
                    });
                })
                .finally(() => {
                    setIsSharing(false);
                });
        }
    }, [gameToShare, toast]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    const lowercasedTerm = searchTerm.toLowerCase();
    return history.filter(game => 
        game.homeTeam.name.toLowerCase().includes(lowercasedTerm) ||
        game.awayTeam.name.toLowerCase().includes(lowercasedTerm) ||
        (game.settings.name && game.settings.name.toLowerCase().includes(lowercasedTerm)) ||
        new Date(game.date).toLocaleString().toLowerCase().includes(lowercasedTerm)
    );
  }, [history, searchTerm]);

  const handleDeleteGames = async (gameIds: string[]) => {
    await deleteFinishedGames(gameIds);
    setHistory(prev => prev.filter(game => !gameIds.includes(game.id)));
    
    if(gameIds.length > 1) {
        toast({
            title: "Partidos Eliminados",
            description: `${gameIds.length} partidos han sido eliminados del historial.`,
        });
    } else {
        toast({
            title: "Partido Eliminado",
            description: "El partido ha sido eliminado del historial.",
        });
    }
    setSelectedGameIds(new Set()); // Clear selection
  };
  
  const handleToggleSelection = (gameId: string, selectAll?: boolean) => {
      if (selectAll) {
          if (selectedGameIds.size === filteredHistory.length) {
              setSelectedGameIds(new Set()); // Deselect all
          } else {
              setSelectedGameIds(new Set(filteredHistory.map(g => g.id))); // Select all filtered
          }
      } else {
          setSelectedGameIds(prev => {
              const newSelection = new Set(prev);
              if (newSelection.has(gameId)) {
                  newSelection.delete(gameId);
              } else {
                  newSelection.add(gameId);
              }
              return newSelection;
          });
      }
  }

  const handleImportGame = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            const importedGame: Game = JSON.parse(content);

            if (!importedGame.id || !importedGame.homeTeam || !importedGame.awayTeam || !importedGame.gameLog) {
                throw new Error("El archivo no tiene el formato de partido correcto.");
            }
            
            const newItemsCount = await importGames([importedGame]);

            if (newItemsCount > 0) {
                 setHistory(prev => [importedGame, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                 toast({
                    title: "Partido Importado",
                    description: `El partido ${importedGame.homeTeam.name} vs ${importedGame.awayTeam.name} ha sido añadido al historial.`
                });
            } else {
                 toast({
                    title: "Importación Omitida",
                    description: "Un partido con el mismo ID ya existe en el historial.",
                    variant: "default"
                });
            }

        } catch (err) {
            toast({
                title: "Error al Importar",
                description: "El archivo seleccionado no es un JSON de partido válido.",
                variant: "destructive"
            });
        } finally {
            if(importFileRef.current) {
                importFileRef.current.value = "";
            }
        }
    };
    reader.readAsText(file);
  }

  const handleResumeGame = async (gameToResume: Game) => {
        const existingLiveGame = await getLiveGame();
        if (existingLiveGame) {
            toast({
                title: "Juego en Curso",
                description: "Ya hay un partido en progreso. Finalízalo antes de reanudar otro.",
                variant: "destructive",
            });
            return;
        }

      // Important: Remove the game from the history *before* setting it as live
      await deleteFinishedGames([gameToResume.id]);
      setHistory(prev => prev.filter(game => game.id !== gameToResume.id));

      await saveLiveGame(gameToResume);
      
      router.push('/game/live');

      toast({
          title: "Partido Reanudado",
          description: "Se ha cargado el partido en la pantalla de juego en vivo."
      });
  };
  
  if (gameIdToShow) {
      const game = history.find(g => g.id === gameIdToShow);
      const backLink = tournamentIdContext ? `/stats?tournamentId=${tournamentIdContext}` : '/history';
      const backLinkText = tournamentIdContext ? 'Volver al Torneo' : 'Volver al Historial';
      return (
            <div className="container mx-auto px-4 py-8">
              <Button asChild variant="ghost" className="mb-4 pl-0">
                <Link href={backLink}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {backLinkText}
                </Link>
              </Button>
              {isLoading ? <p>Cargando...</p> : game ? <GameBoxScore game={game} /> : <p>Partido no encontrado.</p>}
          </div>
      )
  }


  if (isLoading) {
    return <LoadingModal />;
  }

  return (
    <>
    {(isSharing || gameToShare) && <LoadingModal text="Generando imagen..." />}
     {/* Hidden card for sharing */}
    <div className="fixed -left-[9999px] top-0">
      {gameToShare && <ShareCard ref={shareCardRef} game={gameToShare} />}
    </div>

    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Historial de Juegos</h1>
            <p className="text-muted-foreground">Revisa estadísticas y resúmenes de tus juegos pasados.</p>
        </div>
        {isClient && selectedGameIds.size > 0 && (
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedGameIds.size} seleccionado{selectedGameIds.size > 1 ? 's' : ''}</span>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="sm" disabled={isGuest}>
                            <Trash2 className="mr-2 h-4 w-4"/> Eliminar Seleccionados
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará {selectedGameIds.size} partido{selectedGameIds.size > 1 ? 's' : ''} permanentemente.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteGames(Array.from(selectedGameIds))}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        )}
      </div>
      
        {history.length > 0 ? (
            <>
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por equipo, nombre del partido o fecha..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={() => importFileRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Importar Partido (JSON)
                    </Button>
                    <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={handleImportGame} />
                </div>
                <div className="border rounded-lg">
                    <div className="flex items-center p-4 border-b bg-muted/50">
                        <Checkbox
                            id="select-all-games"
                            checked={isClient && selectedGameIds.size === filteredHistory.length && filteredHistory.length > 0}
                            onCheckedChange={() => handleToggleSelection('', true)}
                            aria-label="Seleccionar todos los partidos"
                            className="mr-4"
                            disabled={!isClient}
                        />
                        <Label htmlFor="select-all-games" className="text-sm font-medium">
                            Seleccionar todo
                        </Label>
                    </div>
                    <div className="space-y-0">
                        {filteredHistory.map((game) => (
                            <div key={game.id} className={`p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 border-b last:border-b-0 transition-colors ${isClient && selectedGameIds.has(game.id) ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
                                <div className="flex items-center">
                                    <Checkbox
                                        id={`select-game-${game.id}`}
                                        checked={isClient && selectedGameIds.has(game.id)}
                                        onCheckedChange={() => handleToggleSelection(game.id)}
                                        aria-label={`Seleccionar partido ${game.id}`}
                                        className="mr-4"
                                        disabled={!isClient}
                                    />
                                    <div className="md:col-span-2">
                                    <div className="flex items-center gap-4">
                                        {game.tournamentId && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                                                <Link href={`/stats?tournamentId=${game.tournamentId}`}>
                                                    <Trophy className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        )}
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
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {game.settings.name && <span className="font-semibold">{game.settings.name}</span>}
                                        {game.settings.name && " - "}
                                        {new Date(game.date).toLocaleString()}
                                    </p>
                                    </div>
                                </div>
                
                                <div className="hidden md:block"></div>

                                <div className="flex items-center justify-start md:justify-end gap-2 flex-wrap">
                                    <Button variant="outline" size="sm" onClick={() => setGameToShare(game)}>
                                        <Share2 className="h-4 w-4 mr-2" /> Compartir
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Download className="h-4 w-4 mr-2" /> Exportar
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => exportBoxScoreToCsv(game)}>
                                                <BarChart className="mr-2 h-4 w-4" /> Box Score (CSV)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => exportPlayByPlayToCsv(game)}>
                                                <FileText className="mr-2 h-4 w-4" /> Play-by-Play (CSV)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => exportGameToJson(game)}>
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
                                                    El partido se cargará como el partido en vivo y se eliminará del historial para evitar duplicados. Podrás volver a guardarlo cuando termines.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleResumeGame(game)}>Sí, Reanudar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href={`/history?gameId=${game.id}`}>
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
                                            <AlertDialogTitle>¿Estás seguro de que quieres eliminar este partido?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción es permanente y no se puede deshacer. El partido será eliminado de tu historial.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteGames([game.id])}>Eliminar Partido</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        ))}
                        {filteredHistory.length === 0 && (
                            <p className="p-8 text-center text-muted-foreground">
                                No se encontraron resultados para "{searchTerm}".
                            </p>
                        )}
                    </div>
                </div>
            </>
        ) : (
             <Card>
                <CardHeader>
                <CardTitle>No se han jugado partidos</CardTitle>
                <CardDescription>Aún no has seguido ningún juego. Comienza un nuevo juego para ver su historial aquí.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <Button asChild>
                        <Link href="/game/setup">Comenzar Nuevo Juego</Link>
                    </Button>
                     <Button variant="outline" onClick={() => importFileRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Importar Partido
                    </Button>
                    <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={handleImportGame} />
                </CardContent>
            </Card>
        )}
    </div>
    </>
  );
}

export default function HistoryPage() {
    return (
        <Suspense fallback={<div className="container mx-auto px-4 py-8"><p>Cargando...</p></div>}>
            <HistoryContent />
        </Suspense>
    )
}

    
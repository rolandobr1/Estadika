
'use client';
import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronsRight, Trash2, Search, ArrowLeft, RotateCcw, Upload } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { Game, PlayerStats, TeamInGame, GameAction } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoadingModal } from '@/components/ui/loader';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFinishedGames, deleteFinishedGames, importGames, saveLiveGame, getLiveGame } from '@/lib/db';

const ScoreboardByQuarter = ({ game }: { game: Game }) => {
    const calculateQuarterScores = () => {
        const quarterScores: { home: number[], away: number[] } = { home: [], away: [] };
        const numPeriods = Math.max(game.settings.quarters, game.currentQuarter);

        for (let q = 1; q <= numPeriods; q++) {
            const actionsInQuarter = game.gameLog.filter(action => {
                const payload = action.payload;
                // Type guard to ensure payload is not a full Game object and has the quarter property
                return typeof payload === 'object' && payload !== null && !('homeTeam' in payload) && 'quarter' in payload && payload.quarter === q;
            });
            
            let homeScoreInQuarter = 0;
            let awayScoreInQuarter = 0;

            if (actionsInQuarter.length > 0) {
                 const scoreUpdates = actionsInQuarter.filter(a => a.type === 'SCORE_UPDATE');
                 scoreUpdates.forEach(action => {
                     const payload = action.payload;
                     if (typeof payload === 'object' && payload !== null && !('homeTeam' in payload)) {
                         if (payload.teamId === 'homeTeam') {
                             homeScoreInQuarter += payload.pointsScored || 0;
                         } else {
                             awayScoreInQuarter += payload.pointsScored || 0;
                         }
                     }
                 });
            }
            
            quarterScores.home.push(homeScoreInQuarter);
            quarterScores.away.push(awayScoreInQuarter);
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


const GameBoxScore = ({ game }: { game: Game }) => {

    const calculateShootingPercentage = (made: number, attempted: number): string => {
        if (attempted === 0) return '0.0%';
        return ((made / attempted) * 100).toFixed(1) + '%';
    };

    const TeamBoxScore = ({ team }: { team: TeamInGame }) => {
        const teamTotals = team.players.reduce((acc, player) => {
            const stats = team.playerStats[player.id];
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
                            <TableHead className="min-w-[150px]">Jugador</TableHead>
                            <TableHead className="text-center">PTS</TableHead>
                            <TableHead className="text-center">REB</TableHead>
                            <TableHead className="text-center">AST</TableHead>
                            <TableHead className="text-center">ROB</TableHead>
                            <TableHead className="text-center">TAP</TableHead>
                            <TableHead className="text-center">TC</TableHead>
                            <TableHead className="text-center">TC%</TableHead>
                            <TableHead className="text-center">3P</TableHead>
                            <TableHead className="text-center">3P%</TableHead>
                            <TableHead className="text-center">TL</TableHead>
                            <TableHead className="text-center">TL%</TableHead>
                            <TableHead className="text-center">FP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {team.players.map(player => {
                             const stats = team.playerStats[player.id];
                             const fgPerc = calculateShootingPercentage(stats['2PM'] + stats['3PM'], stats['2PA'] + stats['3PA']);
                             const threePerc = calculateShootingPercentage(stats['3PM'], stats['3PA']);
                             const ftPerc = calculateShootingPercentage(stats['1PM'], stats['1PA']);

                            return (
                                <TableRow key={player.id}>
                                    <TableCell className="font-medium">
                                        <span className="font-semibold">#{player.number} {player.name}</span>
                                        {player.position && <span className="text-xs text-muted-foreground block">{player.position}</span>}
                                    </TableCell>
                                    <TableCell className="text-center">{stats.PTS}</TableCell>
                                    <TableCell className="text-center">{stats.REB}</TableCell>
                                    <TableCell className="text-center">{stats.AST}</TableCell>
                                    <TableCell className="text-center">{stats.STL}</TableCell>
                                    <TableCell className="text-center">{stats.BLK}</TableCell>
                                    <TableCell className="text-center">{stats['2PM'] + stats['3PM']}-{stats['2PA'] + stats['3PA']}</TableCell>
                                    <TableCell className="text-center">{fgPerc}</TableCell>
                                    <TableCell className="text-center">{stats['3PM']}-{stats['3PA']}</TableCell>
                                    <TableCell className="text-center">{threePerc}</TableCell>
                                    <TableCell className="text-center">{stats['1PM']}-{stats['1PA']}</TableCell>
                                    <TableCell className="text-center">{ftPerc}</TableCell>
                                    <TableCell className="text-center">{stats.PF + stats.UF + stats.TF}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                     <TableFooter>
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Totales del Equipo</TableCell>
                            <TableCell className="text-center">{teamTotals.PTS}</TableCell>
                            <TableCell className="text-center">{teamTotals.REB}</TableCell>
                            <TableCell className="text-center">{teamTotals.AST}</TableCell>
                            <TableCell className="text-center">{teamTotals.STL}</TableCell>
                            <TableCell className="text-center">{teamTotals.BLK}</TableCell>
                            <TableCell className="text-center">{teamTotals['2PM'] + teamTotals['3PM']}-{teamTotals['2PA'] + teamTotals['3PA']}</TableCell>
                            <TableCell className="text-center">{calculateShootingPercentage(teamTotals['2PM'] + teamTotals['3PM'], teamTotals['2PA'] + teamTotals['3PA'])}</TableCell>
                            <TableCell className="text-center">{teamTotals['3PM']}-{teamTotals['3PA']}</TableCell>
                            <TableCell className="text-center">{calculateShootingPercentage(teamTotals['3PM'], teamTotals['3PA'])}</TableCell>
                            <TableCell className="text-center">{teamTotals['1PM']}-{teamTotals['1PA']}</TableCell>
                            <TableCell className="text-center">{calculateShootingPercentage(teamTotals['1PM'], teamTotals['1PA'])}</TableCell>
                            <TableCell className="text-center">{teamTotals.PF + teamTotals.UF + teamTotals.TF}</TableCell>
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
  const router = useRouter();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);

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
                setHistory(gamesFromDb.sort((a: Game, b: Game) => b.date - a.date));
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

  const handleExportGame = (game: Game) => {
    const gameJson = JSON.stringify(game, null, 2);
    const blob = new Blob([gameJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const homeTeamName = game.homeTeam.name.replace(/\s/g, '_');
    const awayTeamName = game.awayTeam.name.replace(/\s/g, '_');
    a.href = url;
    a.download = `partido_${homeTeamName}_vs_${awayTeamName}_${game.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
        title: 'Partido Exportado',
        description: 'Los datos del partido se han guardado en un archivo JSON.',
    });
  };

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
                 setHistory(prev => [importedGame, ...prev].sort((a, b) => b.date - a.date));
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

  if (history.length === 0) {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Historial de Juegos</h1>
                <p className="text-muted-foreground">Revisa estadísticas y resúmenes de tus juegos pasados.</p>
            </div>
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
        </div>
    )
  }

  const selectedCount = selectedGameIds.size;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Historial de Juegos</h1>
            <p className="text-muted-foreground">Revisa estadísticas y resúmenes de tus juegos pasados.</p>
        </div>
        {isClient && selectedCount > 0 && (
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4"/> Eliminar Seleccionados
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará {selectedCount} partido{selectedCount > 1 ? 's' : ''} permanentemente.
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
                       <Button variant="outline" size="sm" onClick={() => handleExportGame(game)}>
                         <Download className="h-4 w-4 mr-2" /> Exportar (JSON)
                       </Button>
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
                                 <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
                                <AlertDialogAction onClick={() => handleDeleteGames([game.id])}>Eliminar</AlertDialogAction>
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
    </div>
  );
}

export default function HistoryPage() {
    return (
        <Suspense fallback={<div className="container mx-auto px-4 py-8"><p>Cargando...</p></div>}>
            <HistoryContent />
        </Suspense>
    )
}

    
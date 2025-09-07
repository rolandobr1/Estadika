

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, Trophy, Minus, Plus } from 'lucide-react';
import type { Team, Player, Tournament, TournamentTeam, TournamentPlayer, TournamentMatch, TournamentFormat, PlayoffFormat, GameSettings, AppSettings, TimeoutMode } from '@/lib/types';
import { defaultAppSettings } from '@/lib/types';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LoadingModal } from '@/components/ui/loader';
import { getTeams, getPlayers, saveTournament } from '@/lib/db';

type ScheduleGenerationOption = 'random' | 'manual';

export default function CreateTournamentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  
  const [tournamentName, setTournamentName] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('round-robin');
  const [tournamentRounds, setTournamentRounds] = useState('1');
  const [gameSettings, setGameSettings] = useState<GameSettings>(defaultAppSettings.gameSettings);
  const [scheduleGeneration, setScheduleGeneration] = useState<ScheduleGenerationOption>('random');


  // Playoff State
  const [playoffsEnabled, setPlayoffsEnabled] = useState(false);
  const [finalFormat, setFinalFormat] = useState<PlayoffFormat>('best-of-3');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);


  useEffect(() => {
    async function loadData() {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }
        
        try {
            const [teamsFromDb, playersFromDb] = await Promise.all([getTeams(), getPlayers()]);
            setAllTeams(teamsFromDb);
            setAllPlayers(playersFromDb);

            const storedSettings = localStorage.getItem('appSettings');
            if (storedSettings) {
                const parsedSettings: AppSettings = JSON.parse(storedSettings);
                setGameSettings(prev => ({ 
                    ...prev, 
                    ...(parsedSettings.gameSettings || {}) 
                }));
            }
        } catch (error) {
            console.error("Failed to load roster data:", error);
            toast({
                title: 'Error al Cargar Datos',
                description: 'No se pudo cargar la plantilla. Inténtalo de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }
    loadData();
  }, [toast]);

  const handleToggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const handleSettingChange = (field: keyof GameSettings, value: any) => {
    setGameSettings(prev => ({...prev, [field]: value}));
  };

   const handleTimeoutSettingChange = (field: keyof GameSettings['timeoutSettings'], value: any) => {
        setGameSettings(prev => ({
            ...prev,
            timeoutSettings: {
                ...prev.timeoutSettings,
                [field]: value,
            }
        }));
    };

  const generateSchedule = (teamIds: string[], tournamentId: string, format: TournamentFormat, rounds: number): TournamentMatch[] => {
      let matches: TournamentMatch[] = [];
      if (teamIds.length < 2) return [];

      if (format === 'round-robin') {
          for (let round = 0; round < rounds; round++) {
              for (let i = 0; i < teamIds.length; i++) {
                  for (let j = i + 1; j < teamIds.length; j++) {
                      // Alternate home/away for the second round
                      const team1Id = round % 2 === 0 ? teamIds[i] : teamIds[j];
                      const team2Id = round % 2 === 0 ? teamIds[j] : teamIds[i];
                      matches.push({
                          id: `match_${tournamentId}_r${round + 1}_${team1Id}_vs_${team2Id}`,
                          team1: { id: team1Id },
                          team2: { id: team2Id },
                          status: 'PENDING',
                          stage: 'regular-season',
                      });
                  }
              }
          }
      }
      
      // Fisher-Yates shuffle
      for (let i = matches.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [matches[i], matches[j]] = [matches[j], matches[i]];
      }

      return matches;
  }

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre del torneo no puede estar vacío.',
      });
      return;
    }
    if (selectedTeamIds.size < 2) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar al menos 2 equipos.',
      });
      return;
    }

    setIsCreating(true);

    try {
        const participatingTeams: TournamentTeam[] = allTeams
          .filter(team => selectedTeamIds.has(team.id))
          .map(team => {
            const tournamentPlayers: TournamentPlayer[] = allPlayers
              .filter(player => team.playerIds.includes(player.id))
              .map(player => ({ ...player }));

            return {
              id: team.id,
              name: team.name,
              players: tournamentPlayers,
              wins: 0,
              losses: 0,
              pointsFor: 0,
              pointsAgainst: 0,
            };
          });
          
        const tournamentId = `tourn_${Date.now()}`;
        const numRounds = parseInt(tournamentRounds, 10);
        
        let matches: TournamentMatch[] = [];
        if (scheduleGeneration === 'random') {
            matches = generateSchedule(Array.from(selectedTeamIds), tournamentId, tournamentFormat, numRounds);
        }
        
        const newTournament: Tournament = {
          id: tournamentId,
          name: tournamentName,
          teams: participatingTeams,
          matches,
          gameSettings,
          format: tournamentFormat,
          rounds: numRounds,
          playoffSettings: {
            enabled: playoffsEnabled,
            ...(playoffsEnabled && { finalFormat: finalFormat }),
          }
        };
        
        await saveTournament(newTournament);

        toast({
          title: '¡Torneo Creado!',
          description: `El torneo "${tournamentName}" ha sido creado con ${participatingTeams.length} equipos.`,
        });

        router.push('/tournaments');

    } catch (error) {
        console.error("Failed to create tournament:", error);
        toast({
            title: 'Error al Crear Torneo',
            description: 'No se pudo guardar el torneo. Por favor, inténtalo de nuevo.',
            variant: 'destructive',
        });
    } finally {
        setIsCreating(false);
    }
  };

  const GameSettingInput = ({ label, value, onChange, disabled = false, min = 0 }: { label: string, value: number, onChange: (value: number) => void, disabled?: boolean, min?: number }) => (
        <div className="flex flex-col items-center space-y-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => onChange(value - 1)} disabled={disabled || value <= min}>
                    <Minus className="h-4 w-4" />
                </Button>
                <Input className="text-center w-20 h-9" readOnly value={String(value)} disabled={disabled} />
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => onChange(value + 1)} disabled={disabled}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
    
  if (isLoading) {
    return <LoadingModal />;
  }

  return (
    <>
    {isCreating && <LoadingModal text="Creando torneo..." />}
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4 pl-0">
          <Link href="/tournaments">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Torneos
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Crear Nuevo Torneo</h1>
        <p className="text-muted-foreground">Define los detalles de tu nueva competición.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 space-y-8">
           <Card>
            <CardHeader>
              <CardTitle>1. Detalles del Torneo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tournamentName">Nombre del Torneo</Label>
                <Input
                  id="tournamentName"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Ej: Copa de Verano"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Equipos Participantes</CardTitle>
              <CardDescription>Selecciona los equipos de tu plantilla que jugarán en este torneo.</CardDescription>
            </CardHeader>
            <CardContent>
              {allTeams.length > 0 ? (
                <ScrollArea className="h-96 rounded-md border">
                  <div className="p-4">
                    {allTeams.map(team => (
                      <div key={team.id} className="flex items-center space-x-3 p-3 mb-2 rounded-md hover:bg-muted/50">
                        <Checkbox
                          id={`team-sel-${team.id}`}
                          checked={selectedTeamIds.has(team.id)}
                          onCheckedChange={() => handleToggleTeam(team.id)}
                        />
                        <Label htmlFor={`team-sel-${team.id}`} className="w-full cursor-pointer">
                          <div className="font-semibold">{team.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center">
                            <Users className="mr-1.5 h-3 w-3" />
                            {team.playerIds.length} jugadores
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-10 border rounded-md">
                    <p className="text-muted-foreground">No has creado ningún equipo en tu plantilla principal.</p>
                    <Button asChild variant="link">
                        <Link href="/roster">Ir a la Plantilla</Link>
                    </Button>
                </div>
              )}
            </CardContent>
          </Card>
            <Card>
                <CardHeader>
                    <CardTitle>3. Generación de Calendario</CardTitle>
                    <CardDescription>Elige cómo se crearán los partidos de la temporada regular.</CardDescription>
                </CardHeader>
                <CardContent>
                     <RadioGroup
                        value={scheduleGeneration}
                        onValueChange={(value) => setScheduleGeneration(value as ScheduleGenerationOption)}
                    >
                        <div className="flex items-start space-x-3 p-3 rounded-md border">
                            <RadioGroupItem value="random" id="random-schedule" className="mt-1"/>
                            <Label htmlFor="random-schedule" className="w-full cursor-pointer">
                                <span className="font-semibold">Generar calendario aleatoriamente</span>
                                <p className="text-sm text-muted-foreground">Crea automáticamente todos los partidos de la temporada regular. Recomendado para un inicio rápido.</p>
                            </Label>
                        </div>
                         <div className="flex items-start space-x-3 p-3 rounded-md border">
                            <RadioGroupItem value="manual" id="manual-schedule" className="mt-1"/>
                            <Label htmlFor="manual-schedule" className="w-full cursor-pointer">
                                 <span className="font-semibold">Crear calendario manualmente más tarde</span>
                                 <p className="text-sm text-muted-foreground">El torneo se creará sin partidos. Tendrás que añadirlos manually desde la página del torneo.</p>
                            </Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6 sticky top-8">
           <Card>
            <CardHeader>
              <CardTitle>Ajustes del Partido</CardTitle>
               <CardDescription>Reglas que se aplicarán a todos los partidos del torneo.</CardDescription>
            </CardHeader>
             <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <GameSettingInput label="Nº de Cuartos" value={gameSettings.quarters} onChange={val => handleSettingChange('quarters', val)} min={1} />
                        <GameSettingInput label="Duración Cuarto (min)" value={gameSettings.quarterLength} onChange={val => handleSettingChange('quarterLength', val)} min={1} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <GameSettingInput label="Duración Prórroga (min)" value={gameSettings.overtimeLength} onChange={val => handleSettingChange('overtimeLength', val)} min={1} />
                         <GameSettingInput label="Faltas para Bonus" value={gameSettings.foulsToBonus} onChange={val => handleSettingChange('foulsToBonus', val)} min={1} />
                    </div>
                     <div className="space-y-4 border-t pt-6">
                        <h4 className="text-base font-semibold text-muted-foreground">Tiempos Muertos</h4>
                         <RadioGroup
                                value={gameSettings.timeoutSettings.mode}
                                onValueChange={(value) => handleTimeoutSettingChange('mode', value as TimeoutMode)}
                                className="space-y-2"
                            >
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="per_quarter" id="t-p-q" />
                                    <Label htmlFor="t-p-q" className="cursor-pointer">Por Cuarto (Igual)</Label>
                                </div>
                                 <div className="flex items-center gap-2">
                                    <RadioGroupItem value="per_quarter_custom" id="t-p-q-c" />
                                    <Label htmlFor="t-p-q-c" className="cursor-pointer">Por Cuarto (Personalizado)</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="per_half" id="t-p-h" />
                                    <Label htmlFor="t-p-h" className="cursor-pointer">Por Mitad</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="total" id="t-total" />
                                    <Label htmlFor="t-total" className="cursor-pointer">Total</Label>
                                </div>
                            </RadioGroup>

                        <div className={cn("transition-opacity pt-4", gameSettings.timeoutSettings.mode !== 'per_quarter' && 'opacity-0 h-0 overflow-hidden')}>
                            <GameSettingInput label="Tiempos por Cuarto" value={gameSettings.timeoutSettings.timeoutsPerQuarter} onChange={val => handleTimeoutSettingChange('timeoutsPerQuarter', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_quarter'} />
                        </div>
                        <div className={cn("transition-opacity pt-4 grid grid-cols-2 gap-4", gameSettings.timeoutSettings.mode !== 'per_quarter_custom' && 'opacity-0 h-0 overflow-hidden')}>
                            {Array.from({ length: gameSettings.quarters }).map((_, i) => (
                                <GameSettingInput
                                    key={i}
                                    label={`Cuarto ${i+1}`}
                                    value={gameSettings.timeoutSettings.timeoutsPerQuarterValues[i] || 0}
                                    onChange={(val) => {
                                        const newValues = [...gameSettings.timeoutSettings.timeoutsPerQuarterValues];
                                        newValues[i] = val;
                                        handleTimeoutSettingChange('timeoutsPerQuarterValues', newValues);
                                    }}
                                    disabled={gameSettings.timeoutSettings.mode !== 'per_quarter_custom'}
                                />
                            ))}
                        </div>
                        <div className={cn("transition-opacity pt-4 grid grid-cols-2 gap-4", gameSettings.timeoutSettings.mode !== 'per_half' && 'opacity-0 h-0 overflow-hidden')}>
                            <GameSettingInput label="Tiempos (1ª Mitad)" value={gameSettings.timeoutSettings.timeoutsFirstHalf} onChange={val => handleTimeoutSettingChange('timeoutsFirstHalf', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_half'} />
                            <GameSettingInput label="Tiempos (2ª Mitad)" value={gameSettings.timeoutSettings.timeoutsSecondHalf} onChange={val => handleTimeoutSettingChange('timeoutsSecondHalf', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_half'} />
                        </div>
                        <div className={cn("transition-opacity pt-4", gameSettings.timeoutSettings.mode !== 'total' && 'opacity-0 h-0 overflow-hidden')}>
                            <GameSettingInput label="Tiempos Totales" value={gameSettings.timeoutSettings.timeoutsTotal} onChange={val => handleTimeoutSettingChange('timeoutsTotal', val)} disabled={gameSettings.timeoutSettings.mode !== 'total'} />
                        </div>

                        <div className="pt-4">
                            <GameSettingInput label="Tiempos (Prórroga)" value={gameSettings.timeoutsOvertime} onChange={val => handleSettingChange('timeoutsOvertime', val)} />
                        </div>
                    </div>

                    <div className="space-y-4 border-t pt-6">
                         <h4 className="text-base font-semibold text-muted-foreground">Expulsiones por Faltas</h4>
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="allowFoulOut"
                                checked={gameSettings.allowFoulOut}
                                onCheckedChange={(checked) => handleSettingChange('allowFoulOut', !!checked)}
                            />
                            <label
                                htmlFor="allowFoulOut"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Por faltas personales
                            </label>
                        </div>
                        <div className={`transition-opacity ${!gameSettings.allowFoulOut ? 'opacity-50' : ''}`}>
                             <GameSettingInput label="Nº Faltas para Expulsión" value={gameSettings.foulsToFoulOut} onChange={val => handleSettingChange('foulsToFoulOut', val)} disabled={!gameSettings.allowFoulOut} min={1} />
                        </div>

                         <div className="flex items-center space-x-2 pt-2">
                            <Checkbox 
                                id="allowTechnicalFoulOut"
                                checked={gameSettings.allowTechnicalFoulOut}
                                onCheckedChange={(checked) => handleSettingChange('allowTechnicalFoulOut', !!checked)}
                            />
                            <label
                                htmlFor="allowTechnicalFoulOut"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Por faltas técnicas
                            </label>
                        </div>
                         <div className={`transition-opacity ${!gameSettings.allowTechnicalFoulOut ? 'opacity-50' : ''}`}>
                            <GameSettingInput label="Nº F. Técnicas para Expulsión" value={gameSettings.technicalFoulsToFoulOut} onChange={val => handleSettingChange('technicalFoulsToFoulOut', val)} disabled={!gameSettings.allowTechnicalFoulOut} min={1} />
                        </div>
                    </div>
            </CardContent>
          </Card>
          
           <Card>
                <CardHeader>
                    <CardTitle>Formato de Playoffs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center space-x-2">
                        <Checkbox
                            id="enable-playoffs"
                            checked={playoffsEnabled}
                            onCheckedChange={(checked) => setPlayoffsEnabled(!!checked)}
                        />
                        <Label htmlFor="enable-playoffs" className="cursor-pointer">Habilitar Playoffs</Label>
                     </div>
                     <div className={`space-y-4 transition-opacity ${!playoffsEnabled ? 'opacity-50' : ''}`}>
                        <Separator />
                         <div className="space-y-3">
                            <Label className="font-semibold">Formato de la Final</Label>
                             <RadioGroup
                                value={finalFormat}
                                onValueChange={(value) => setFinalFormat(value as PlayoffFormat)}
                                disabled={!playoffsEnabled}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="best-of-3" id="best-of-3" />
                                    <Label htmlFor="best-of-3" className={!playoffsEnabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
                                        Final al Mejor de 3
                                    </Label>
                                </div>
                                 <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="single-game" id="single-game" disabled />
                                    <Label htmlFor="single-game" className="text-muted-foreground cursor-not-allowed">
                                        Partido Único (Próximamente)
                                    </Label>
                                </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">
                                Los 2 mejores equipos de la temporada regular avanzarán a la final.
                            </p>
                         </div>
                     </div>
                </CardContent>
            </Card>

          <Button size="lg" className="w-full" onClick={handleCreateTournament} disabled={isCreating}>
             <Trophy className="mr-2 h-5 w-5" />
            {isCreating ? 'Creando...' : 'Crear Torneo'}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}

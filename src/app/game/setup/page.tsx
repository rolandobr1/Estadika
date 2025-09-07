

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, FileDown, ArrowRight, AlertTriangle, Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { Player, Team, Game, TeamInGame, PlayerStats, GameSettings, AppSettings, TimeoutMode } from '@/lib/types';
import { defaultAppSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LoadingModal } from '@/components/ui/loader';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getPlayers, getTeams, saveLiveGame, getLiveGame, importPlayers, importTeams } from '@/lib/db';
import { createInitialGame, createTeamInGame } from '@/lib/game-utils';
import { produce } from 'immer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { demoPlayers, demoTeams } from '@/lib/demo-data';


const PlayerSelectionModal = ({
    isOpen,
    onClose,
    onConfirm,
    allPlayers,
    unavailablePlayerIds = [],
    initialSelectedIds = []
}: {
    isOpen: boolean,
    onClose: () => void,
    onConfirm: (selectedPlayers: Player[]) => void,
    allPlayers: Player[],
    unavailablePlayerIds: string[],
    initialSelectedIds: string[],
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(initialSelectedIds));
        }
    }, [initialSelectedIds, isOpen]);

    const handleTogglePlayer = (playerId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else {
                newSet.add(playerId);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        const selectedPlayers = allPlayers.filter(p => selectedIds.has(p.id));
        onConfirm(selectedPlayers);
        onClose();
    };

    const filteredPlayers = allPlayers.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Seleccionar Jugadores</DialogTitle>
                    <DialogDescription>Elige los jugadores que participarán en el partido.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Input 
                        placeholder="Buscar jugador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <ScrollArea className="h-72 rounded-md border">
                        <div className="p-4">
                            {filteredPlayers.map(player => {
                                const isUnavailable = unavailablePlayerIds.includes(player.id) && !selectedIds.has(player.id);
                                return (
                                    <div key={player.id} className={cn("flex items-center space-x-3 p-3 mb-2 rounded-md", !isUnavailable && "hover:bg-muted/50")}>
                                        <Checkbox
                                            id={`player-sel-${player.id}`}
                                            checked={selectedIds.has(player.id)}
                                            onCheckedChange={() => handleTogglePlayer(player.id)}
                                            disabled={isUnavailable}
                                        />
                                        <Label htmlFor={`player-sel-${player.id}`} className={cn("w-full", isUnavailable ? "text-muted-foreground line-through" : "cursor-pointer")}>
                                            #{player.number || '-'} {player.name}
                                            {isUnavailable && <span className="text-xs"> (En otro equipo)</span>}
                                        </Label>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleConfirm}>Confirmar Selección ({selectedIds.size})</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const LoadTeamModal = ({
    isOpen,
    onClose,
    onLoad,
    teams,
    unavailableTeamId
}: {
    isOpen: boolean,
    onClose: () => void,
    onLoad: (team: Team) => void,
    teams: Team[],
    unavailableTeamId?: string
}) => {
    const availableTeams = teams.filter(t => t.id !== unavailableTeamId);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cargar Equipo Predefinido</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    {availableTeams.length > 0 ? availableTeams.map(team => (
                        <Button
                            key={team.id}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => {
                                onLoad(team);
                                onClose();
                            }}
                        >
                            <Users className="mr-2 h-4 w-4" /> {team.name} ({team.playerIds.length} jugadores)
                        </Button>
                    )) : (
                        <p className="text-muted-foreground text-center">No hay otros equipos guardados para cargar.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function GameSetupPage() {
    const router = useRouter();
    const { toast } = useToast();

    // Data from DB
    const [roster, setRoster] = useState<Player[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    
    // Page State
    const [homeTeamName, setHomeTeamName] = useState('Local');
    const [awayTeamName, setAwayTeamName] = useState('Visitante');
    const [homeTeamId, setHomeTeamId] = useState<string | undefined>();
    const [awayTeamId, setAwayTeamId] = useState<string | undefined>();
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);

    const [gameSettings, setGameSettings] = useState<GameSettings>(defaultAppSettings.gameSettings);
    
    const [isHomeSelectionOpen, setIsHomeSelectionOpen] = useState(false);
    const [isAwaySelectionOpen, setIsAwaySelectionOpen] = useState(false);
    const [isHomeLoadOpen, setIsHomeLoadOpen] = useState(false);
    const [isAwayLoadOpen, setIsAwayLoadOpen] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [gameInProgress, setGameInProgress] = useState<boolean | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isStartingGame, setIsStartingGame] = useState(false);
    
    useEffect(() => {
        async function loadData() {
            if (typeof window === 'undefined') {
                setIsLoading(false);
                return;
            }

            try {
                const liveGame = await getLiveGame();
                if (liveGame) {
                    setGameInProgress(true);
                } else {
                    setGameInProgress(false);
                    const [playersFromDb, teamsFromDb] = await Promise.all([getPlayers(), getTeams()]);
                    setRoster(playersFromDb);
                    setTeams(teamsFromDb);

                    const storedSettings = localStorage.getItem('appSettings');
                    if (storedSettings) {
                        const parsedSettings: AppSettings = JSON.parse(storedSettings);
                        setGameSettings(prev => ({
                            ...prev,
                            ...(parsedSettings.gameSettings || {})
                        }));
                    }
                }
            } catch (e) {
                console.error("Could not load data", e);
                toast({
                    variant: 'destructive',
                    title: 'Error al cargar datos',
                    description: 'No se pudo obtener la plantilla de jugadores y equipos.',
                });
            } finally {
                setIsLoading(false);
            }
        }
        
        loadData();
    }, [toast]);
    
     useEffect(() => {
        if (gameInProgress === true) {
            router.push('/game/live');
        }
    }, [gameInProgress, router]);

    const handleLoadTeam = (team: Team, teamType: 'home' | 'away') => {
        const teamPlayers = roster.filter(p => team.playerIds.includes(p.id));

        if (teamType === 'home') {
            setHomeTeamName(team.name);
            setHomeTeamId(team.id);
            // Exclude players already in the away team
            const awayPlayerIds = new Set(awayPlayers.map(p => p.id));
            const filteredPlayers = teamPlayers.filter(p => !awayPlayerIds.has(p.id));
            setHomePlayers(filteredPlayers);

        } else {
            setAwayTeamName(team.name);
            setAwayTeamId(team.id);
            // Exclude players already in the home team
            const homePlayerIds = new Set(homePlayers.map(p => p.id));
            const filteredPlayers = teamPlayers.filter(p => !homePlayerIds.has(p.id));
            setAwayPlayers(filteredPlayers);
        }
    };

     const handleSettingChange = (field: keyof GameSettings, value: number | string | boolean) => {
        if (typeof value === 'number' && value < 0) return;
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
    
    const handleStartGame = async () => {
        if (gameInProgress) {
            return;
        }

        if (homePlayers.length < 1 || awayPlayers.length < 1) {
            setError("Ambos equipos deben tener al menos un jugador seleccionado.");
            return;
        }

        // Check for duplicate players across teams
        const homePlayerIds = new Set(homePlayers.map(p => p.id));
        const duplicate = awayPlayers.find(p => homePlayerIds.has(p.id));
        if (duplicate) {
            setError(`El jugador "${duplicate.name}" no puede estar en ambos equipos.`);
            return;
        }

        setIsStartingGame(true);

        const newGame = produce(createInitialGame(), draft => {
            const finalGameSettings = {
                ...gameSettings,
                // Ensure times are stored in seconds in the final game object
                quarterLength: gameSettings.quarterLength * 60,
                overtimeLength: gameSettings.overtimeLength * 60,
            };
            
            draft.settings = finalGameSettings;
            draft.gameClock = finalGameSettings.quarterLength;
            draft.timeoutClock = gameSettings.timeoutLength;
            draft.status = 'IN_PROGRESS';

            draft.homeTeam = createTeamInGame('homeTeam', homeTeamName, homePlayers, gameSettings.quarters);
            draft.awayTeam = createTeamInGame('awayTeam', awayTeamName, awayPlayers, gameSettings.quarters);

            const getInitialTimeouts = () => {
                const { timeoutSettings } = gameSettings;
                switch (timeoutSettings.mode) {
                    case 'per_quarter': return timeoutSettings.timeoutsPerQuarter;
                    case 'per_quarter_custom': return timeoutSettings.timeoutsPerQuarterValues[0] ?? 0;
                    case 'per_half': return timeoutSettings.timeoutsFirstHalf;
                    case 'total': return timeoutSettings.timeoutsTotal;
                    default: return 0;
                }
            };

            const initialTimeouts = getInitialTimeouts();
            draft.homeTeam.stats.timeouts = initialTimeouts;
            draft.awayTeam.stats.timeouts = initialTimeouts;
        });

        try {
            await saveLiveGame(newGame);
            toast({
                title: "¡Partido Creado!",
                description: "Todo listo. ¡Que comience el juego!",
            });
            router.push('/game/live');
        } catch (error) {
            console.error("Error saving live game:", error);
            toast({
                title: "Error al Guardar",
                description: "No se pudo iniciar el partido. Inténtalo de nuevo.",
                variant: 'destructive',
            });
            setIsStartingGame(false);
        }
    };

    const TeamCard = ({ side }: { side: 'home' | 'away' }) => {
        const isHome = side === 'home';
        const teamName = isHome ? homeTeamName : awayTeamName;
        const setTeamName = isHome ? setHomeTeamName : setAwayTeamName;
        const players = isHome ? homePlayers : awayPlayers;
        const setPlayers = isHome ? setHomePlayers : setAwayPlayers;
        const openSelection = () => isHome ? setIsHomeSelectionOpen(true) : setIsAwaySelectionOpen(true);
        const openLoad = () => isHome ? setIsHomeLoadOpen(true) : setIsAwayLoadOpen(true);
        const unavailablePlayerIds = (isHome ? awayPlayers : homePlayers).map(p => p.id);
        const unavailableTeamId = isHome ? awayTeamId : homeTeamId;

        return (
            <Card>
                <CardHeader>
                     <CardTitle className="text-2xl font-semibold">
                        Equipo {isHome ? 'Local' : 'Visitante'}
                     </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor={`${side}TeamName`} className="sr-only">Nombre del Equipo</Label>
                        <Input
                            id={`${side}TeamName`}
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-3">
                        <Button variant="default" className="w-full justify-center py-6 text-base" onClick={openSelection}>
                            <Users className="mr-2 h-5 w-5" /> Seleccionar Jugadores ({players.length})
                        </Button>
                        <Button variant="secondary" className="w-full justify-center py-6 text-base" onClick={openLoad} disabled={teams.length === 0}>
                            <FileDown className="mr-2 h-5 w-5" /> Cargar Equipo Predefinido
                        </Button>
                    </div>
                    {isHome ? (
                         <PlayerSelectionModal
                            isOpen={isHomeSelectionOpen}
                            onClose={() => setIsHomeSelectionOpen(false)}
                            onConfirm={setHomePlayers}
                            allPlayers={roster}
                            unavailablePlayerIds={unavailablePlayerIds}
                            initialSelectedIds={homePlayers.map(p => p.id)}
                         />
                    ) : (
                         <PlayerSelectionModal
                            isOpen={isAwaySelectionOpen}
                            onClose={() => setIsAwaySelectionOpen(false)}
                            onConfirm={setAwayPlayers}
                            allPlayers={roster}
                            unavailablePlayerIds={unavailablePlayerIds}
                            initialSelectedIds={awayPlayers.map(p => p.id)}
                         />
                    )}
                     {isHome ? (
                        <LoadTeamModal
                            isOpen={isHomeLoadOpen}
                            onClose={() => setIsHomeLoadOpen(false)}
                            onLoad={(team) => handleLoadTeam(team, 'home')}
                            teams={teams}
                            unavailableTeamId={awayTeamId}
                        />
                     ) : (
                         <LoadTeamModal
                            isOpen={isAwayLoadOpen}
                            onClose={() => setIsAwayLoadOpen(false)}
                            onLoad={(team) => handleLoadTeam(team, 'away')}
                            teams={teams}
                            unavailableTeamId={homeTeamId}
                        />
                     )}

                    <div className="p-2 border rounded-md min-h-[100px] bg-muted/30">
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Jugadores Seleccionados:</h4>
                        {players.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                                {players.map(p => <li key={p.id} className="font-medium">#{p.number} {p.name}</li>)}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Ningún jugador seleccionado</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    const GameSettingInput = ({ label, field, value, onChange, disabled = false, min = 0 }: { label: string, field?: keyof GameSettings, value: number, onChange: (val: number) => void, disabled?: boolean, min?: number }) => (
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

    if (isLoading || gameInProgress === undefined) {
        return <LoadingModal />;
    }

    if (gameInProgress) {
        return <LoadingModal text="Redirigiendo al partido en curso..." />;
    }
    
    return (
        <>
            {isStartingGame && <LoadingModal text="Creando partido..." />}
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Configuración del Partido</h1>
                    <p className="text-muted-foreground">Define los equipos y reglas antes de empezar.</p>
                </div>

                <Tabs defaultValue="rules" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="rules">1. Reglas</TabsTrigger>
                        <TabsTrigger value="teams">2. Equipos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="rules" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ajustes del Partido</CardTitle>
                                <CardDescription>Estos ajustes anularán la configuración por defecto.</CardDescription>
                            </CardHeader>
                             <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="gameName">Nombre del Partido (Opcional)</Label>
                                    <Input
                                        id="gameName"
                                        placeholder="Ej: Final Campeonato"
                                        value={gameSettings.name}
                                        onChange={(e) => handleSettingChange('name', e.target.value)}
                                    />
                                </div>
                                <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                                    <AccordionItem value="item-1">
                                        <AccordionTrigger className="text-lg font-semibold">Tiempo de Juego</AccordionTrigger>
                                        <AccordionContent className="pt-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                                <GameSettingInput label="Nº de Cuartos" value={gameSettings.quarters} onChange={val => handleSettingChange('quarters', val)} min={1}/>
                                                <GameSettingInput label="Duración Cuarto (min)" value={gameSettings.quarterLength} onChange={val => handleSettingChange('quarterLength', val)} min={1}/>
                                                <GameSettingInput label="Duración Prórroga (min)" value={gameSettings.overtimeLength} onChange={val => handleSettingChange('overtimeLength', val)} min={1}/>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                    <AccordionItem value="item-2">
                                        <AccordionTrigger className="text-lg font-semibold">Tiempos Muertos</AccordionTrigger>
                                        <AccordionContent className="pt-4 space-y-6">
                                            <div className='space-y-4'>
                                                <Label className="font-semibold">Modo de Tiempos Muertos</Label>
                                                <RadioGroup
                                                    value={gameSettings.timeoutSettings.mode}
                                                    onValueChange={(value) => handleTimeoutSettingChange('mode', value as TimeoutMode)}
                                                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                                >
                                                    <Label htmlFor="tm-per-quarter" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'per_quarter' && 'border-primary bg-primary/5')}>
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem value="per_quarter" id="tm-per-quarter" />
                                                            <span className="font-semibold">Por Cuarto (Igual)</span>
                                                        </div>
                                                    </Label>
                                                    <Label htmlFor="tm-per-quarter-custom" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'per_quarter_custom' && 'border-primary bg-primary/5')}>
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem value="per_quarter_custom" id="tm-per-quarter-custom" />
                                                            <span className="font-semibold">Por Cuarto (Personalizado)</span>
                                                        </div>
                                                    </Label>
                                                    <Label htmlFor="tm-per-half" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'per_half' && 'border-primary bg-primary/5')}>
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem value="per_half" id="tm-per-half" />
                                                            <span className="font-semibold">Por Mitad</span>
                                                        </div>
                                                    </Label>
                                                    <Label htmlFor="tm-total" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'total' && 'border-primary bg-primary/5')}>
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem value="total" id="tm-total" />
                                                            <span className="font-semibold">Total por Partido</span>
                                                        </div>
                                                    </Label>
                                                </RadioGroup>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-4">
                                                <div className={cn("transition-opacity", gameSettings.timeoutSettings.mode !== 'per_quarter' && 'opacity-50')}>
                                                    <GameSettingInput label="Tiempos por Cuarto" value={gameSettings.timeoutSettings.timeoutsPerQuarter} onChange={val => handleTimeoutSettingChange('timeoutsPerQuarter', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_quarter'} />
                                                </div>
                                                <div className={cn("transition-opacity col-span-1 sm:col-span-2 grid grid-cols-2 gap-6", gameSettings.timeoutSettings.mode !== 'per_half' && 'opacity-50')}>
                                                    <GameSettingInput label="Tiempos (1ª Mitad)" value={gameSettings.timeoutSettings.timeoutsFirstHalf} onChange={val => handleTimeoutSettingChange('timeoutsFirstHalf', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_half'} />
                                                    <GameSettingInput label="Tiempos (2ª Mitad)" value={gameSettings.timeoutSettings.timeoutsSecondHalf} onChange={val => handleTimeoutSettingChange('timeoutsSecondHalf', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_half'} />
                                                </div>
                                                <div className={cn("transition-opacity", gameSettings.timeoutSettings.mode !== 'total' && 'opacity-50')}>
                                                    <GameSettingInput label="Tiempos Totales" value={gameSettings.timeoutSettings.timeoutsTotal} onChange={val => handleTimeoutSettingChange('timeoutsTotal', val)} disabled={gameSettings.timeoutSettings.mode !== 'total'} />
                                                </div>
                                                <GameSettingInput label="Tiempos (Prórroga)" value={gameSettings.timeoutsOvertime} onChange={val => handleSettingChange('timeoutsOvertime', val)} />
                                            </div>
                                            <div className={cn("pt-4 space-y-4", gameSettings.timeoutSettings.mode !== 'per_quarter_custom' && 'hidden')}>
                                                <Label className="font-semibold">Tiempos Muertos por Cuarto</Label>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {Array.from({ length: gameSettings.quarters }).map((_, i) => (
                                                        <GameSettingInput
                                                            key={i}
                                                            label={`Cuarto ${i + 1}`}
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
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                    <AccordionItem value="item-3" className="border-b-0">
                                        <AccordionTrigger className="text-lg font-semibold">Reglas de Faltas</AccordionTrigger>
                                        <AccordionContent className="pt-4 space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <GameSettingInput label="Faltas para Bonus" value={gameSettings.foulsToBonus} onChange={val => handleSettingChange('foulsToBonus', val)} min={1}/>
                                            </div>
                                            <div className="space-y-4 pt-4">
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
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="teams" className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            <TeamCard side="home" />
                            <TeamCard side="away" />
                        </div>
                    </TabsContent>
                </Tabs>
                
                <Separator className="my-8" />
                
                <div className="flex justify-end">
                    <Button size="lg" onClick={handleStartGame} disabled={isStartingGame}>
                        Iniciar Partido <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>

            <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Error de Configuración</AlertDialogTitle>
                        <AlertDialogDescription>
                            {error}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setError(null)}>Entendido</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

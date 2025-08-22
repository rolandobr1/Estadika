
'use client';

import { useReducer, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Pause, Play, Redo, SkipForward, Plus, Minus, Save, ArrowRightLeft, ShieldAlert, Undo, Clock, ListCollapse, BarChartHorizontal, Download, Timer, Settings, Share2 } from 'lucide-react';
import { PiUserSwitchBold } from "react-icons/pi";
import { IoStatsChart } from "react-icons/io5";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import type { Game, Player, TeamInGame, StatType, PlayerStats, GameAction, AppSettings, ActionType, Tournament, TournamentTeam } from '@/lib/types';
import { defaultAppSettings } from '@/lib/types';
import { createInitialGame, recalculateGameStateFromLog, applyActionToGameState } from '@/lib/game-utils';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { produce } from 'immer';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { LoadingModal } from '@/components/ui/loader';
import { getLiveGame, saveFinishedGame, deleteLiveGame, getTournaments, saveTournament } from '@/lib/db';

// Reducer to manage game state by processing actions and updating the log
function gameReducer(state: Game, action: GameAction): Game {
    if (state.status === 'FINISHED' && !['GAME_END', 'GAME_START', 'REOPEN_GAME'].includes(action.type)) {
        return state;
    }
    
    const incrementalActions: ActionType[] = [
        'SCORE_UPDATE', 'STAT_UPDATE', 'TIMEOUT', 'SUBSTITUTION', 'ADD_PLAYER_TO_COURT',
        'QUARTER_CHANGE', 'MANUAL_TIMER_ADJUST', 'SET_TIMER'
    ];

    if (incrementalActions.includes(action.type)) {
        return applyActionToGameState(state, action);
    }

    // For other actions, handle them with the existing logic
    switch (action.type) {
        case 'GAME_START':
            return produce(state, draft => {
                Object.assign(draft, action.payload);
            });
        
        case 'TIMER_CHANGE':
            return produce(state, draft => {
                 if (action.payload.timerState === 'PLAY') draft.clockIsRunning = true;
                 if (action.payload.timerState === 'PAUSE') draft.clockIsRunning = false;
                 if (action.payload.timerState === 'RESET') {
                    draft.clockIsRunning = false;
                    const newClockValue = draft.currentQuarter > draft.settings.quarters
                        ? draft.settings.overtimeLength
                        : draft.settings.quarterLength;
                    draft.gameClock = newClockValue;
                 }
            });
        
        case 'TICK':
            return produce(state, draft => {
                if (draft.isTimeoutActive) {
                    draft.timeoutClock = Math.max(0, draft.timeoutClock - 1);
                    if (draft.timeoutClock === 0) {
                        draft.isTimeoutActive = false;
                        draft.timeoutCaller = undefined;
                        // Don't auto-start clock, let user do it
                    }
                } else if (draft.clockIsRunning) {
                    draft.gameClock = Math.max(0, draft.gameClock - 1);
                    if (draft.gameClock === 0) {
                        draft.clockIsRunning = false;
                        
                        // Apply the quarter change logic directly to the draft
                        applyActionToGameState(draft as Game, {
                            type: 'QUARTER_CHANGE',
                            id: `action_${Date.now()}`,
                            timestamp: Date.now(),
                            description: `Final del periodo ${draft.currentQuarter}.`,
                            payload: { newQuarter: draft.currentQuarter + 1, quarter: draft.currentQuarter, gameClock: 0, homeScore: draft.homeTeam.stats.score, awayScore: draft.awayTeam.stats.score }
                        }, false);
                    }
                }
            });
            
        case 'GAME_END':
             return produce(state, draft => {
                draft.status = 'FINISHED';
                draft.clockIsRunning = false;
                draft.previousScores = action.payload.previousScores;
                draft.gameLog.push(action);
             });

        case 'REOPEN_GAME': {
            const gameToReopen: Game = action.payload as any;
            
            // Re-establish the full game state from payload
            let nextState = produce(gameToReopen, draft => {
                draft.status = 'IN_PROGRESS';
                draft.clockIsRunning = false;
                
                // If we are re-opening, the "current" score becomes the "previous" score for the next time we save.
                draft.previousScores = { home: draft.homeTeam.stats.score, away: draft.awayTeam.stats.score };

                // Remove the GAME_END action from the log
                const gameEndIndex = draft.gameLog.findIndex(a => a.type === 'GAME_END');
                if (gameEndIndex > -1) {
                    draft.gameLog.splice(gameEndIndex, 1);
                }
            });

            // Recalculate to ensure everything is consistent after removing the end action
            return recalculateGameStateFromLog(nextState, nextState.gameLog);
        }
        
        case 'UNDO_LAST_ACTION': {
             if(state.gameLog.length === 0) return state;
             const newState = createInitialGame();
             return produce(newState, draft => {
                Object.assign(draft, baseGame);
                const newLog = state.gameLog.slice(0, -1);
                draft.gameLog = newLog;
                const recalculatedState = recalculateGameStateFromLog(draft, newLog);
                Object.assign(draft, recalculatedState);
             });
        }
        default:
             return state;
    }
}


const StatBadge = ({ value, label, color }: { value: number, label: string, color: string }) => (
    <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-sm font-bold ${color}`}>
            {value}
        </div>
        <span className="text-xs mt-1 text-muted-foreground hidden sm:block">{label}</span>
    </div>
)

const statDetails: Record<string, { label: string, color: string, value: number }> = {
    '1PM': { label: '1P', color: 'bg-green-600 hover:bg-green-700', value: 1 },
    '2PM': { label: '2P', color: 'bg-green-600 hover:bg-green-700', value: 2 },
    '3PM': { label: '3P', color: 'bg-green-600 hover:bg-green-700', value: 3 },
    'AST': { label: 'Asis.', color: 'bg-purple-600 hover:bg-purple-700', value: 0 },
    'STL': { label: 'Robo', color: 'bg-cyan-500 hover:bg-cyan-600', value: 0 },
    'BLK': { label: 'Tapón', color: 'bg-blue-700 hover:bg-blue-800', value: 0 },
    'PF': { label: 'Falta', color: 'bg-red-600 hover:bg-red-700', value: 0 },
    'DREB': { label: 'Reb. Def.', color: 'bg-orange-500 hover:bg-orange-600', value: 0 },
    'UF': { label: 'Antidep.', color: 'bg-red-800 hover:bg-red-900', value: 0 },
    'TF': { label: 'Técnica', color: 'bg-red-800 hover:bg-red-900', value: 0 },
    'OREB': { label: 'Reb. Of.', color: 'bg-orange-500 hover:bg-orange-600', value: 0 },
    'TOV': { label: 'Pérdida', color: 'bg-yellow-600 hover:bg-yellow-700', value: 0 },
    '1PA': { label: '1PA', color: 'bg-gray-400', value: 0 },
    '2PA': { label: '2PA', color: 'bg-gray-400', value: 0 },
    '3PA': { label: '3PA', color: 'bg-gray-400', value: 0 },
};

const PlayerStatsInput = ({ player, playerStats, onStatClick, onOpenModal, onSubstitute, lastActionKey, inFoulTrouble }: { player: Player, playerStats: PlayerStats, onStatClick: (stat: StatType, value: number) => void, onOpenModal: () => void, onSubstitute: () => void, lastActionKey?: string | null, inFoulTrouble: boolean }) => {
    
    const fixedStatShortcuts: StatType[] = ['1PM', '2PM', '3PM', 'DREB', 'AST', 'STL', 'BLK', 'PF'];
    
    const statButtons = fixedStatShortcuts.map(stat => ({
        stat: stat,
        value: statDetails[stat as StatType]?.value ?? 0,
        label: statDetails[stat as StatType]?.label ?? stat,
        color: statDetails[stat as StatType]?.color ?? 'bg-gray-500',
        actionKey: `${player.id}-${stat}`
    }));


    const handleButtonClick = (stat: StatType, value: number) => {
        onStatClick(stat, value);
    };
    
    return (
        <Card key={player.id} className={cn("bg-card shadow-sm overflow-hidden", inFoulTrouble && "border-destructive/50")}>
            <CardHeader className="p-2 bg-secondary/30">
                <div className="flex flex-wrap items-center justify-between w-full gap-y-2">
                    <div className="flex items-center gap-2 flex-grow">
                        <div className="font-bold text-base sm:text-lg">#{player.number}</div>
                        <div className="font-semibold text-sm sm:text-base truncate">{player.name}</div>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenModal}>
                            <IoStatsChart className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSubstitute}>
                            <PiUserSwitchBold className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="w-full flex items-center justify-between">
                         <div className="flex items-center gap-1.5">
                            <StatBadge value={playerStats.PTS} label="PTS" color="bg-green-500" />
                            <StatBadge value={playerStats.REB} label="REB" color="bg-orange-500" />
                            <StatBadge value={playerStats.AST} label="AST" color="bg-purple-500" />
                            <StatBadge value={playerStats.STL} label="ROB" color="bg-cyan-500" />
                            <StatBadge value={playerStats.BLK} label="TAP" color="bg-blue-700" />
                            <StatBadge value={playerStats.PF + playerStats.UF + playerStats.TF} label="Faltas" color="bg-red-500" />
                        </div>
                        {inFoulTrouble && <Badge variant="destructive" className="animate-pulse">PELIGRO DE EXPULSIÓN</Badge>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-2">
                 <div className={`grid w-full gap-1.5 grid-cols-4 sm:grid-cols-4`}>
                    {statButtons.map(({ stat, value, label, color, actionKey }) => (
                         <Button 
                            key={actionKey}
                            onClick={() => handleButtonClick(stat as StatType, value)} 
                            className={cn(
                                color, 
                                "text-white font-bold h-10 text-xs sm:text-sm transition-transform duration-150",
                                lastActionKey === actionKey ? "transform scale-110 ring-2 ring-offset-2 ring-yellow-400" : ""
                            )}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

type EditingPlayerInfo = {
    teamId: 'homeTeam' | 'awayTeam';
    playerId: string;
};

const PlayerStatsModal = ({
    isOpen,
    onClose,
    onStatChange,
    game,
    editingInfo,
}: {
    isOpen: boolean;
    onClose: () => void;
    onStatChange: (playerId: string, teamId: 'homeTeam' | 'awayTeam', stat: StatType, adjustment: 1 | -1) => void;
    game: Game;
    editingInfo: EditingPlayerInfo | null;
}) => {
    if (!editingInfo || !game) return null;

    const { teamId, playerId } = editingInfo;
    const team = game[teamId];
    const player = team.players.find(p => p.id === playerId);
    const stats = team.playerStats[playerId];

    if (!player || !stats) return null;

    const statCategories = {
        "Tiros de Campo": { '2PA': 'Intentados', '2PM': 'Anotados', '3PA': 'Intentados 3P', '3PM': 'Anotados 3P' },
        "Tiros Libres": { '1PA': 'Intentados', '1PM': 'Anotados' },
        "Juego": { 'OREB': 'Rebotes Ofensivos', 'DREB': 'Rebotes Defensivos', 'AST': 'Asistencias', 'STL': 'Robos', 'BLK': 'Tapones', 'TOV': 'Pérdidas' },
        "Faltas": { 'PF': 'Personales', 'UF': 'Antideportivas', 'TF': 'Técnicas' },
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Estadísticas de #{player.number} {player.name}</DialogTitle>
                    <DialogDescription>Ajusta las estadísticas del jugador. Los cambios se guardan automáticamente.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
                    {Object.entries(statCategories).map(([category, statItems]) => (
                        <div key={category}>
                            <h4 className="font-semibold text-lg mb-2 text-primary">{category}</h4>
                            <div className="space-y-2">
                                {Object.entries(statItems).map(([stat, label]) => (
                                    <div key={stat} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                                        <span className="font-medium text-muted-foreground">{label}</span>
                                        <div className="flex items-center gap-3">
                                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onStatChange(player.id, teamId, stat as StatType, -1)}>
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="font-bold text-lg w-8 text-center">{stats[stat as StatType]}</span>
                                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onStatChange(player.id, teamId, stat as StatType, 1)}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};

type SubstitutionState = {
    teamId: 'homeTeam' | 'awayTeam';
    playerInId: string | undefined;
    playerOutId: string | undefined;
    mode: 'in' | 'out';
} | null;


const SubstitutionModal = ({
    isOpen,
    onClose,
    onConfirm,
    subState,
    game,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (playerInId: string, playerOutId: string) => void;
    subState: SubstitutionState;
    game: Game;
}) => {
    if (!subState || !game) return null;

    const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>();
    const team = game[subState.teamId];

    const onCourtPlayers = team.players.filter(p => team.playersOnCourt.includes(p.id));
    const benchPlayers = team.players.filter(p => !team.playersOnCourt.includes(p.id));

    const getModalConfig = () => {
        const playerOut = team.players.find(p => p.id === subState.playerOutId);
        const playerIn = team.players.find(p => p.id === subState.playerInId);

        if (subState.mode === 'in' && playerIn) {
             return {
                title: 'Sustituir Jugador',
                description: `Selecciona el jugador que saldrá de la cancha para que entre #${playerIn.number} ${playerIn.name}.`,
                playersToList: onCourtPlayers,
            };
        }
        if (subState.mode === 'out' && playerOut) {
             return {
                title: 'Sustituir Jugador',
                description: `Selecciona el jugador del banquillo que entrará por #${playerOut.number} ${playerOut.name}.`,
                playersToList: benchPlayers,
            };
        }
        return { title: '', description: '', playersToList: [] };
    }
    
    const { title, description, playersToList } = getModalConfig();


    useEffect(() => {
        if (isOpen) {
            setSelectedPlayerId(undefined);
        }
    }, [isOpen]);

    const handleConfirmClick = () => {
        if (!selectedPlayerId || !subState) return;
        
        if (subState.mode === 'in' && subState.playerInId) {
            onConfirm(subState.playerInId, selectedPlayerId);
        } else if (subState.mode === 'out' && subState.playerOutId) {
            onConfirm(selectedPlayerId, subState.playerOutId);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-72 overflow-y-auto">
                    <RadioGroup value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                        {playersToList.map(player => (
                             <div key={player.id} className="flex items-center p-3 rounded-md hover:bg-muted/50">
                                <RadioGroupItem value={player.id} id={`sub-${player.id}`} />
                                <Label htmlFor={`sub-${player.id}`} className="w-full cursor-pointer pl-3">
                                    <span className="font-semibold">#{player.number} {player.name}</span>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleConfirmClick} disabled={!selectedPlayerId}>Confirmar Sustitución</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const formatClock = (clock: number) => {
    const minutes = Math.floor(clock / 60);
    const seconds = clock % 60;
    return { minutes, seconds };
};


const ClockSettingsModal = ({
    isOpen,
    onClose,
    onAdjustTime,
    onSetTime,
    currentTime,
    disabled = false
}: {
    isOpen: boolean;
    onClose: () => void;
    onAdjustTime: (seconds: number) => void;
    onSetTime: (seconds: number) => void;
    currentTime: number;
    disabled?: boolean;
}) => {
    const [minutes, setMinutes] = useState(formatClock(currentTime).minutes);
    const [seconds, setSeconds] = useState(formatClock(currentTime).seconds);

    useEffect(() => {
        if (isOpen) {
            const { minutes: currentMinutes, seconds: currentSeconds } = formatClock(currentTime);
            setMinutes(currentMinutes);
            setSeconds(currentSeconds);
        }
    }, [isOpen, currentTime]);

    const handleSetTime = () => {
        const totalSeconds = (minutes * 60) + seconds;
        onSetTime(totalSeconds);
        onClose();
    };

    const handleAdjustTime = (adjustment: number) => {
        onAdjustTime(adjustment);
        onClose();
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajustes del Reloj</DialogTitle>
                    <DialogDescription>
                        Modifica el tiempo del partido. El reloj se detendrá para realizar el ajuste.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Establecer tiempo</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={minutes}
                                onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                placeholder="MM"
                                className="h-10 w-24 text-center text-lg"
                                aria-label="Minutes"
                                disabled={disabled}
                            />
                            <span className="font-bold text-lg">:</span>
                            <Input
                                type="number"
                                value={seconds}
                                onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                                placeholder="SS"
                                className="h-10 w-24 text-center text-lg"
                                aria-label="Seconds"
                                disabled={disabled}
                            />
                        </div>
                    </div>
                    <Separator />
                    <p className="text-sm font-medium text-muted-foreground">O ajusta rápidamente:</p>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => handleAdjustTime(60)} disabled={disabled}>+ 1:00</Button>
                        <Button variant="outline" onClick={() => handleAdjustTime(-60)} disabled={disabled}>- 1:00</Button>
                        <Button variant="outline" onClick={() => handleAdjustTime(10)} disabled={disabled}>+ 0:10</Button>
                        <Button variant="outline" onClick={() => handleAdjustTime(-10)} disabled={disabled}>- 0:10</Button>
                    </div>
                </div>
                 <DialogFooter className="mt-4">
                     <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSetTime} disabled={disabled}>Establecer Tiempo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function LiveGamePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [baseGame, setBaseGame] = useState(createInitialGame());
  const [game, dispatch] = useReducer(gameReducer, baseGame);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [lastActionKey, setLastActionKey] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<EditingPlayerInfo | null>(null);
  const [substitutionState, setSubstitutionState] = useState<SubstitutionState>(null);
  const [teamsSwapped, setTeamsSwapped] = useState(false);
  const [activeTab, setActiveTab] = useState<'homeTeam' | 'awayTeam'>('homeTeam');
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishingGame, setIsFinishingGame] = useState(false);

  useEffect(() => {
    async function loadGame() {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }
        
        try {
            const liveGame = await getLiveGame();
            if (liveGame) {
                setBaseGame(liveGame);
                if (liveGame.status === 'FINISHED') {
                    dispatch({ type: 'REOPEN_GAME', id: `action_${Date.now()}`, timestamp: Date.now(), description: 'Game re-opened from history.', payload: liveGame });
                } else {
                    dispatch({ type: 'GAME_START', id: `action_${Date.now()}`, timestamp: Date.now(), description: 'Game loaded from storage.', payload: liveGame });
                }
            } else {
                router.replace('/game/setup');
                return;
            }

            const storedSettings = localStorage.getItem('appSettings');
            setAppSettings(storedSettings ? JSON.parse(storedSettings) : defaultAppSettings);
        } catch (error) {
            console.error("Failed to load live game", error);
            toast({ title: "Error al cargar", description: "No se pudo cargar el partido en curso." });
            router.replace('/game/setup');
        } finally {
            setIsLoading(false);
        }
    }
    loadGame();
  }, [router, toast]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (game.clockIsRunning || game.isTimeoutActive) {
        interval = setInterval(() => {
            dispatch({
                type: 'TICK',
                id: `action_${Date.now()}`,
                timestamp: Date.now(),
                description: 'Clock tick',
                payload: {
                    quarter: game.currentQuarter,
                    gameClock: game.gameClock,
                    homeScore: game.homeTeam.stats.score,
                    awayScore: game.awayTeam.stats.score,
                }
            });
        }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [game.clockIsRunning, game.isTimeoutActive, game.currentQuarter, game.gameClock, game.homeTeam.stats.score, game.awayTeam.stats.score]);


  useEffect(() => {
    if(lastActionKey) {
        const timer = setTimeout(() => setLastActionKey(null), 300);
        return () => clearTimeout(timer);
    }
  }, [lastActionKey]);

  useEffect(() => {
      const currentActiveSide = teamsSwapped ? 'awayTeam' : 'homeTeam';
      if (activeTab !== currentActiveSide && activeTab !== (teamsSwapped ? 'homeTeam' : 'awayTeam')) {
          setActiveTab(currentActiveSide);
      }
  }, [teamsSwapped, activeTab]);


  const handleFinishGame = () => {
    if (typeof window === 'undefined') return;

    setIsFinishingGame(true);
    
    const action: GameAction = {
        id: `action_${Date.now()}`,
        type: 'GAME_END',
        timestamp: Date.now(),
        description: 'El partido ha finalizado.',
        payload: {
            quarter: game.currentQuarter,
            gameClock: game.gameClock,
            homeScore: game.homeTeam.stats.score,
            awayScore: game.awayTeam.stats.score,
            previousScores: game.previousScores, // Pass previous scores if they exist
        },
    };
    dispatch(action);
  };
  
  useEffect(() => {
    if (game.status !== 'FINISHED' || isLoading) {
        return;
    }

    const saveAndCleanup = async () => {
        const finalGameData = produce(game, draft => {
            draft.status = 'FINISHED';
            draft.clockIsRunning = false;
        });

        try {
            await saveFinishedGame(finalGameData);

            if (finalGameData.tournamentId && finalGameData.matchId) {
                const allTournaments = await getTournaments();
                const tournamentIndex = allTournaments.findIndex(t => t.id === finalGameData.tournamentId);

                if (tournamentIndex !== -1) {
                    const tournamentToUpdate = allTournaments[tournamentIndex];
                    const updatedTournament = produce(tournamentToUpdate, (draft: Tournament) => {
                       const match = draft.matches.find(m => m.id === finalGameData.matchId);
                        if (match) {
                            match.status = 'FINISHED';
                            match.team1.score = finalGameData.homeTeam.stats.score;
                            match.team2.score = finalGameData.awayTeam.stats.score;
                            match.gameId = finalGameData.id;
                        }
                        
                        // Recalculate all team stats for the tournament to ensure consistency
                        draft.teams.forEach(team => {
                            team.wins = 0;
                            team.losses = 0;
                            team.pointsFor = 0;
                            team.pointsAgainst = 0;

                            draft.matches.forEach(m => {
                                if (m.status !== 'FINISHED' || (m.team1.id !== team.id && m.team2.id !== team.id)) {
                                    return;
                                }

                                const isTeam1 = m.team1.id === team.id;
                                const teamScore = isTeam1 ? m.team1.score! : m.team2.score!;
                                const opponentScore = isTeam1 ? m.team2.score! : m.team1.score!;

                                team.pointsFor += teamScore;
                                team.pointsAgainst += opponentScore;

                                if (teamScore > opponentScore) {
                                    team.wins++;
                                } else if (opponentScore > teamScore) {
                                    team.losses++;
                                }
                            });
                        });
                    });
                    await saveTournament(updatedTournament);
                    toast({
                        title: "Partido de Torneo Finalizado",
                        description: "Los resultados han sido guardados en el torneo y en el historial general.",
                    });
                }
            } else {
                 toast({
                    title: "Partido Guardado",
                    description: "El partido ha sido guardado en el historial general.",
                });
            }
            
            await deleteLiveGame();

            if (game.tournamentId) {
                router.push(`/stats?tournamentId=${game.tournamentId}`);
            } else {
                router.push('/history');
            }

        } catch (error) {
            console.error("Error finishing game: ", error);
            toast({
                title: "Error al guardar",
                description: "No se pudo guardar el partido. Inténtalo de nuevo.",
                variant: 'destructive',
            });
            setIsFinishingGame(false); // Allow user to try again
        }
    };
    
    saveAndCleanup();
      
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status, isLoading]);

  const createGameAction = (
      type: GameAction['type'],
      description: string,
      payload: Partial<GameAction['payload']>
  ): GameAction => {
      return {
          id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type,
          timestamp: Date.now(),
          description,
          payload: {
              quarter: game.currentQuarter,
              gameClock: game.gameClock,
              homeScore: game.homeTeam.stats.score,
              awayScore: game.awayTeam.stats.score,
              ...payload,
          },
      };
  };

  const handleStatClick = (teamId: 'homeTeam' | 'awayTeam', player: Player, stat: StatType, value: number) => {
    const teamName = game[teamId].name;
    let description = '';
    let actionType: GameAction['type'] = 'STAT_UPDATE';

    if (value > 0) {
        actionType = 'SCORE_UPDATE';
        description = `${player.name} (${teamName}) anotó ${value} punto(s).`;
    } else {
        const statLabel = statDetails[stat as StatType]?.label || stat;
        description = `${statLabel} de ${player.name} (${teamName}).`;
    }
    
    const action = createGameAction(actionType, description, {
        teamId,
        playerId: player.id,
        statType: stat,
        pointsScored: value
    });

    dispatch(action);
    setLastActionKey(`${player.id}-${stat}`);
  };
  
  const handleDetailedStatChange = (playerId: string, teamId: 'homeTeam' | 'awayTeam', stat: StatType, adjustment: 1 | -1) => {
    const player = game[teamId].players.find(p => p.id === playerId);
    const teamName = game[teamId].name;
    if (!player) return;

    const statLabel = statDetails[stat as StatType]?.label || stat;
    const description = `Ajuste manual: ${adjustment > 0 ? '+1' : '-1'} ${statLabel} para ${player.name} (${teamName}).`;
    
    const actionType = (stat === '1PM' || stat === '2PM' || stat === '3PM') ? 'SCORE_UPDATE' : 'STAT_UPDATE';

    const action = createGameAction(actionType, description, {
        teamId,
        playerId,
        statType: stat,
        manualAdjustment: adjustment
    });
    dispatch(action);
  };

  const handleOpenModal = (teamId: 'homeTeam' | 'awayTeam', player: Player) => {
    setEditingPlayer({
        teamId: teamId,
        playerId: player.id,
    });
  };

    const handleOpenSubstitutionModal = (teamId: 'homeTeam' | 'awayTeam', player: Player, mode: 'in' | 'out') => {
        if (mode === 'in') {
            setSubstitutionState({ teamId, playerInId: player.id, playerOutId: undefined, mode: 'in' });
        } else {
            setSubstitutionState({ teamId, playerInId: undefined, playerOutId: player.id, mode: 'out' });
        }
    };

    const handleMovePlayerToCourt = (teamId: 'homeTeam' | 'awayTeam', player: Player) => {
        const team = game[teamId];
        if (team.playersOnCourt.length >= 5) {
            handleOpenSubstitutionModal(teamId, player, 'in');
        } else {
            const description = `${player.name} entra a la cancha por ${team.name}.`;
            const action = createGameAction('ADD_PLAYER_TO_COURT', description, { teamId, playerInId: player.id });
            dispatch(action);
        }
    };

    const handleConfirmSubstitution = (playerInId: string, playerOutId: string) => {
        if (!substitutionState) return;
        const { teamId } = substitutionState;
        const team = game[teamId];
        const playerIn = team.players.find(p => p.id === playerInId);
        const playerOut = team.players.find(p => p.id === playerOutId);
        
        if (!playerIn || !playerOut) return;

        const description = `Sustitución en ${team.name}: Entra ${playerIn.name}, Sale ${playerOut.name}.`;
        const action = createGameAction('SUBSTITUTION', description, { teamId, playerInId, playerOutId });

        dispatch(action);
        setSubstitutionState(null);
    };


  const handleChangeQuarter = (direction: 'next' | 'prev') => {
      let newQuarter = game.currentQuarter;
      if (direction === 'next') {
          newQuarter = game.currentQuarter + 1;
      } else {
          newQuarter = Math.max(1, game.currentQuarter - 1);
      }

      if (newQuarter !== game.currentQuarter) {
           const description = `Cambiado al periodo ${newQuarter}.`;
           const action = createGameAction('QUARTER_CHANGE', description, { newQuarter });
           dispatch(action);
      }
  }

  const handleTimerControl = (timerState: 'PLAY' | 'PAUSE' | 'RESET') => {
      let description = '';
      if (timerState === 'PLAY') description = 'Reloj iniciado.';
      if (timerState === 'PAUSE') description = 'Reloj pausado.';
      if (timerState === 'RESET') description = 'Reloj reseteado.';
      
      const action = createGameAction('TIMER_CHANGE', description, { timerState });
      dispatch(action);
  }

  const handleManualTimeChange = (timeAdjustment: number) => {
    const description = `Ajuste manual del reloj: ${timeAdjustment > 0 ? '+' : ''}${timeAdjustment}s`;
    const action = createGameAction('MANUAL_TIMER_ADJUST', description, { timeAdjustment });
    dispatch(action);
    toast({
        title: "Reloj Ajustado",
        description: `Se han ${timeAdjustment > 0 ? 'añadido' : 'restado'} ${Math.abs(timeAdjustment)} segundos.`
    });
  };

  const handleSetTime = (newTime: number) => {
    const description = `Reloj establecido a ${Math.floor(newTime / 60)}:${(newTime % 60).toString().padStart(2, '0')}`;
    const action = createGameAction('SET_TIMER', description, { newTime });
    dispatch(action);
    toast({
        title: "Reloj Establecido",
        description: `El tiempo se ha establecido a ${Math.floor(newTime / 60)}:${(newTime % 60).toString().padStart(2, '0')}`
    });
  };


  const handleTimeout = (teamId: 'homeTeam' | 'awayTeam') => {
    const description = game.isTimeoutActive
        ? `Reanudación tras tiempo muerto.`
        : `Tiempo muerto solicitado por ${game[teamId].name}.`;
    
    const action = createGameAction('TIMEOUT', description, { teamId });
    dispatch(action);
  }

  const handleUndo = () => {
    if (game.gameLog.length > 0) {
        dispatch({ type: 'UNDO_LAST_ACTION', id: `action_${Date.now()}`, timestamp: Date.now(), description: 'Undo last action', payload: {
            quarter: game.currentQuarter,
            gameClock: game.gameClock,
            homeScore: game.homeTeam.stats.score,
            awayScore: game.awayTeam.stats.score,
        } });
        toast({
            title: "Acción deshecha",
            description: "Se ha revertido la última acción del partido."
        })
    }
  }

  const handleShare = () => {
    const spectatorUrl = `${window.location.origin}/spectator/${game.id}`;
    navigator.clipboard.writeText(spectatorUrl);
    toast({
      title: "Enlace Copiado",
      description: "El enlace del modo espectador ha sido copiado al portapapeles.",
    });
  };

  const TeamPanel = ({ team, teamId, title }: { team: TeamInGame, teamId: 'homeTeam' | 'awayTeam', title: string }) => {
    if (!team || !team.players) return null;
    
    const onCourtPlayers = team.players.filter(p => team.playersOnCourt.includes(p.id));
    const benchPlayers = team.players.filter(p => !team.playersOnCourt.includes(p.id));
    
    return (
        <div className="space-y-4">
             <h2 className="text-xl font-bold text-center lg:text-left">{title}</h2>
            <div>
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">En Cancha ({onCourtPlayers.length})</h3>
              <div className="space-y-2">
                {onCourtPlayers.map(player => {
                    const playerStats = team.playerStats[player.id];
                    const totalFouls = playerStats.PF + playerStats.UF + playerStats.TF;
                    
                    const foulLimit = game.settings.foulsToFoulOut;
                    const inFoulTrouble = game.settings.allowFoulOut && (foulLimit - totalFouls <= 2);

                    return (
                        <PlayerStatsInput 
                            key={player.id} 
                            player={player} 
                            playerStats={playerStats}
                            onStatClick={(stat, value) => handleStatClick(teamId, player, stat, value)}
                            onOpenModal={() => handleOpenModal(teamId, player)}
                            onSubstitute={() => handleOpenSubstitutionModal(teamId, player, 'out')}
                            lastActionKey={lastActionKey}
                            inFoulTrouble={inFoulTrouble}
                        />
                    )
                })}
              </div>
            </div>
            
            <div>
                <h3 className="text-lg font-semibold text-muted-foreground my-2">Banca</h3>
                 <div className="space-y-2">
                    {benchPlayers.map(player => (
                       <Card key={player.id} className="p-3 bg-secondary/20">
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <span className="font-semibold">#{player.number} {player.name}</span>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenModal(teamId, player)}>
                                      <IoStatsChart className="h-5 w-5" />
                                  </Button>
                               </div>
                               <Button size="sm" variant="outline" onClick={() => handleMovePlayerToCourt(teamId, player)}>
                                    <PiUserSwitchBold className="mr-2 h-4 w-4" /> Mover a la cancha
                                </Button>
                           </div>
                       </Card>
                    ))}
                </div>
            </div>
        </div>
    );
  };
  
    const formatActionTime = (action: GameAction) => {
      const mins = Math.floor(action.payload.gameClock / 60).toString().padStart(2, '0');
      const secs = (action.payload.gameClock % 60).toString().padStart(2, '0');
      return `P${action.payload.quarter} ${mins}:${secs} (${action.payload.homeScore} - ${action.payload.awayScore})`;
  }

  const handleExportPlayByPlay = () => {
    if (game.gameLog.length === 0) return;

    const headers = [
        "id", "timestamp", "type", "description", "quarter", "gameClock", 
        "homeScore", "awayScore", "teamId", "playerId", "statType", 
        "pointsScored", "playerInId", "playerOutId", "timerState"
    ];

    const csvRows = [headers.join(',')];

    for (const action of game.gameLog) {
        const row = [
            action.id,
            action.timestamp,
            action.type,
            `"${action.description.replace(/"/g, '""')}"`,
            action.payload.quarter,
            action.payload.gameClock,
            action.payload.homeScore,
            action.payload.awayScore,
            action.payload.teamId || '',
            action.payload.playerId || '',
            action.payload.statType || '',
            action.payload.pointsScored || 0,
            action.payload.playerInId || '',
            action.payload.playerOutId || '',
            action.payload.timerState || ''
        ];
        csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `play_by_play_${game.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
     toast({
        title: 'Play-by-Play Exportado',
        description: 'El historial de jugadas se ha guardado en un archivo CSV.',
    });
  }

  const PlayByPlayContent = () => {
      return (
          <Card>
              <CardContent className="pt-6">
                  {game.gameLog.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Aún no hay acciones registradas.</p>
                  ) : (
                      <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-4">
                              {[...game.gameLog].reverse().map(action => (
                                  <div key={action.id} className="text-sm">
                                      <p className="font-medium">{action.description}</p>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                          <Clock className="h-3 w-3" />
                                          {formatActionTime(action)}
                                      </p>
                                  </div>
                              ))}
                          </div>
                      </ScrollArea>
                  )}
              </CardContent>
          </Card>
      )
  }

  if (isLoading || !appSettings) {
    return <LoadingModal />;
  }
  
  const currentQuarterIndex = game.currentQuarter - 1;

  const ScoreboardCard = ({ team, teamId }: { team: TeamInGame, teamId: 'homeTeam' | 'awayTeam' }) => {
    
    const canCallTimeout = () => {
        if (game.isTimeoutActive && game.timeoutCaller !== teamId) return false;
        if (!game.isTimeoutActive && team.stats.timeouts <= 0) return false;
        return true;
    }

    return (
        <Card className="text-center p-2 sm:p-4">
            <CardTitle className="text-base sm:text-2xl truncate">{team.name}</CardTitle>
            <div className="text-4xl sm:text-6xl font-bold text-primary my-1 sm:my-2">{team.stats.score}</div>
            <div className="flex justify-center items-center gap-2 sm:gap-4">
                 <p className="text-xs sm:text-sm text-muted-foreground">Faltas: {team.stats.foulsByQuarter?.[currentQuarterIndex] || 0}</p>
                 {team.stats.inBonus && <Badge variant="destructive" className="animate-pulse text-xs px-1.5 py-0.5 sm:px-2 sm:py-0.5"><ShieldAlert className="h-3 w-3 mr-1"/>BONUS</Badge>}
            </div>
            <div className="mt-2 sm:mt-3">
                 <Button
                    size="sm"
                    variant={game.isTimeoutActive && game.timeoutCaller === teamId ? "default" : "outline"}
                    className={cn(game.isTimeoutActive && game.timeoutCaller === teamId && "bg-green-600 hover:bg-green-700", "h-8 sm:h-9 text-xs sm:text-sm")}
                    onClick={() => handleTimeout(teamId)}
                    disabled={!canCallTimeout()}
                >
                    <Timer className="mr-1.5 h-4 w-4" />
                    {game.isTimeoutActive && game.timeoutCaller === teamId ? 'Reanudar' : `T. Fuera (${team.stats.timeouts})`}
                </Button>
            </div>
        </Card>
    );
  };

  const team1Scoreboard = teamsSwapped ? game.awayTeam : game.homeTeam;
  const team2Scoreboard = teamsSwapped ? game.homeTeam : game.awayTeam;

  const team1Data = { team: teamsSwapped ? game.awayTeam : game.homeTeam, teamId: (teamsSwapped ? 'awayTeam' : 'homeTeam') as 'homeTeam' | 'awayTeam' };
  const team2Data = { team: teamsSwapped ? game.homeTeam : game.awayTeam, teamId: (teamsSwapped ? 'homeTeam' : 'awayTeam') as 'homeTeam' | 'awayTeam' };
  
  const getPeriodDisplay = () => {
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
      const clock = game.isTimeoutActive ? game.timeoutClock : game.gameClock;
      return `${Math.floor(clock / 60).toString().padStart(2, '0')}:${(clock % 60).toString().padStart(2, '0')}`;
  }
  

  return (
    <>
    {isFinishingGame && <LoadingModal text="Finalizando y guardando..." />}
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <Card className="mb-4 sm:mb-6 bg-card text-card-foreground shadow-lg">
        <CardContent className="p-3 sm:p-6 flex flex-col gap-3 sm:gap-4 items-center">
            <div className="text-center group relative">
                <p className="text-muted-foreground font-semibold text-sm sm:text-base">{getPeriodDisplay()}</p>
                <div className={cn("text-5xl sm:text-7xl font-mono font-bold tracking-tight my-1 sm:my-2", game.isTimeoutActive ? 'text-orange-500' : 'text-primary')}>
                    {getClockDisplay()}
                </div>
            </div>

             <div className="flex items-center justify-center gap-2 w-full max-w-sm">
                <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10 sm:h-11" onClick={() => handleTimerControl(game.clockIsRunning ? 'PAUSE' : 'PLAY')} disabled={game.isTimeoutActive}>
                    {game.clockIsRunning ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                    <span>{game.clockIsRunning ? "Pausar" : "Iniciar"}</span>
                </Button>
                <Button size="lg" variant="secondary" className="flex-1 h-10 sm:h-11" onClick={() => handleTimerControl('RESET')} disabled={game.isTimeoutActive}><Redo className="mr-2"/>Reset</Button>
            </div>
             <div className="flex justify-around items-center text-center text-muted-foreground font-semibold w-full max-w-sm">
                <Button variant="ghost" size="sm" onClick={() => handleChangeQuarter('prev')}><ChevronLeft className="mr-1 h-4 w-4"/> P. Ant.</Button>
                <Button variant="ghost" size="sm" onClick={() => handleChangeQuarter('next')}>P. Sig. <ChevronRight className="ml-1 h-4 w-4"/></Button>
            </div>
            <div className="pt-2 sm:pt-4 border-t w-full max-w-sm text-center">
                 <Button variant="outline" size="sm" onClick={() => setIsClockModalOpen(true)} disabled={game.clockIsRunning}>
                    <Settings className="mr-2 h-4 w-4" />
                    Ajustes del Reloj
                </Button>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 sm:mb-6">
        <ScoreboardCard team={team1Scoreboard} teamId={team1Data.teamId} />
        <Button 
            variant="ghost" 
            size="icon" 
            className="p-2 bg-muted rounded-full hover:bg-muted/80" 
            onClick={() => setTeamsSwapped(!teamsSwapped)}
            aria-label="Intercambiar equipos"
        >
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
        <ScoreboardCard team={team2Scoreboard} teamId={team2Data.teamId} />
      </div>

      <div className="hidden lg:grid grid-cols-2 gap-6">
        <TeamPanel team={team1Data.team} teamId={team1Data.teamId} title={team1Data.team.name} />
        <TeamPanel team={team2Data.team} teamId={team2Data.teamId} title={team2Data.team.name} />
      </div>

      <div className="block lg:hidden">
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as any)} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4 h-auto rounded-lg p-1.5 bg-muted">
            <TabsTrigger value={team1Data.teamId} className="py-2 text-base font-semibold data-[state=active]:shadow-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{team1Data.team.name}</TabsTrigger>
            <TabsTrigger value={team2Data.teamId} className="py-2 text-base font-semibold data-[state=active]:shadow-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{team2Data.team.name}</TabsTrigger>
          </TabsList>
          <TabsContent value={team1Data.teamId}>
              <TeamPanel team={team1Data.team} teamId={team1Data.teamId} title="" />
          </TabsContent>
          <TabsContent value={team2Data.teamId}>
               <TeamPanel team={team2Data.team} teamId={team2Data.teamId} title="" />
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 my-6">
        <Button variant="outline" size="sm" onClick={handleShare} className="h-9 w-full sm:w-auto">
            <Share2 className="mr-2 h-4 w-4" /> Compartir
        </Button>
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={game.gameLog.length === 0} className="h-9 w-full sm:w-auto">
            <Undo className="mr-2 h-4 w-4" /> Deshacer última acción
        </Button>
        <AlertDialog>
            <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-9 w-full sm:w-auto">
                    <Save className="mr-2 h-4 w-4"/> Terminar y Guardar
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción finalizará el juego y lo guardará en el historial. No podrás volver a editarlo.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinishGame}>Finalizar Juego</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>

      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
            <AccordionTrigger className="text-lg font-semibold bg-muted px-4 rounded-md">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <ListCollapse className="h-5 w-5" />
                        Play-by-Play
                    </div>
                     {game.gameLog.length > 0 && (
                        <Button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleExportPlayByPlay();
                            }} 
                            size="sm" 
                            variant="outline"
                            className="mr-2 h-8"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Exportar (CSV)</span>
                             <span className="sm:hidden">CSV</span>
                        </Button>
                    )}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <PlayByPlayContent />
            </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
    <PlayerStatsModal 
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        onStatChange={handleDetailedStatChange}
        game={game}
        editingInfo={editingPlayer}
    />
     <SubstitutionModal
        isOpen={!!substitutionState}
        onClose={() => setSubstitutionState(null)}
        onConfirm={handleConfirmSubstitution}
        subState={substitutionState}
        game={game}
    />
     <ClockSettingsModal
        isOpen={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
        onAdjustTime={handleManualTimeChange}
        onSetTime={handleSetTime}
        currentTime={game.gameClock}
        disabled={game.clockIsRunning || game.isTimeoutActive}
    />
    </>
  );
}

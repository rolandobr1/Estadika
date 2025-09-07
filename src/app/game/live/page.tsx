

'use client';

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useRouter }from 'next/navigation';
import { produce } from 'immer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Pause, Play, Redo, Plus, Minus, Save, ArrowRightLeft, ShieldAlert, Undo, Clock, ListCollapse, BarChartHorizontal, Download, Timer, Settings, UserCog, Eye, EyeOff, RotateCcw, Users, ClipboardList, ClipboardCheck, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import type { Game, Player, StatType, PlayerStats, GameAction, Tournament, SubstitutionState, FollowUpActionState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingModal } from '@/components/ui/loader';
import { deleteLiveGame, getTournamentById, finishAndSaveGameBatch, getLiveGame, saveLiveGame } from '@/lib/db';
import { applyActionToGameState, createInitialGame, recalculateGameStateFromLog } from '@/lib/game-utils';
import { exportPlayByPlayToCsv } from '@/lib/export';


const StatBadge = ({ value, label, color }: { value: number, label: string, color: string }) => (
    <div className="flex flex-col items-center">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold', color)}>
            {value}
        </div>
        <span className="text-[10px] mt-0.5 text-muted-foreground">{label}</span>
    </div>
);


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

const PlayerStatsInput = memo(({ player, playerStats, onStatClick, onOpenModal, onSubstitute, lastActionKey, inFoulTrouble, showSummary, onToggleSummary }: { player: Player, playerStats: PlayerStats, onStatClick: (stat: StatType, value: number) => void, onOpenModal: () => void, onSubstitute: () => void, lastActionKey?: string | null, inFoulTrouble: boolean, showSummary: boolean, onToggleSummary: () => void }) => {
    const fixedStatShortcuts: StatType[] = ['1PM', '2PM', '3PM', 'DREB', 'AST', 'STL', 'BLK', 'PF'];
    
    const statButtons = fixedStatShortcuts.map(stat => ({
        stat: stat,
        value: statDetails[stat as StatType]?.value ?? 0,
        label: statDetails[stat as StatType]?.label ?? stat,
        color: statDetails[stat as StatType]?.color ?? 'bg-gray-500',
        actionKey: `${player.id}-${stat}`
    }));

    return (
        <Card key={player.id} className={cn("bg-card shadow-sm overflow-hidden", inFoulTrouble && "border-destructive/50")}>
            <CardHeader className="p-2 bg-secondary/30">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between w-full gap-x-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="font-bold text-base sm:text-lg">#{player.number}</div>
                            <div className="font-semibold text-sm sm:text-base truncate flex items-center gap-2">
                                <span className="truncate">{player.name}</span>
                                {inFoulTrouble && <Badge variant="destructive" className="animate-pulse px-2 py-0.5 text-xs flex-shrink-0">PELIGRO</Badge>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleSummary}>
                                {showSummary ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenModal}>
                                <BarChartHorizontal className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSubstitute}>
                                <UserCog className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                    {showSummary && (
                        <div className="flex items-center justify-around w-full">
                            <StatBadge value={playerStats.PTS} label="PTS" color="bg-green-500" />
                            <StatBadge value={playerStats.REB} label="REB" color="bg-orange-500" />
                            <StatBadge value={playerStats.AST} label="AST" color="bg-purple-500" />
                            <StatBadge value={playerStats.STL} label="ROB" color="bg-cyan-500" />
                            <StatBadge value={playerStats.BLK} label="TAP" color="bg-blue-700" />
                            <StatBadge value={playerStats.PF + playerStats.UF + playerStats.TF} label="Faltas" color="bg-red-500" />
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-2">
                 <div className={`grid w-full gap-1.5 grid-cols-4 sm:grid-cols-4`}>
                    {statButtons.map(({ stat, value, label, color, actionKey }) => (
                         <Button 
                            key={actionKey}
                            onClick={() => onStatClick(stat as StatType, value)} 
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
});
PlayerStatsInput.displayName = 'PlayerStatsInput';


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

                <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-around my-4">
                    <StatBadge value={stats.PTS} label="PTS" color="bg-green-500" />
                    <StatBadge value={stats.REB} label="REB" color="bg-orange-500" />
                    <StatBadge value={stats.AST} label="AST" color="bg-purple-500" />
                    <StatBadge value={stats.STL} label="ROB" color="bg-cyan-500" />
                    <StatBadge value={stats.BLK} label="TAP" color="bg-blue-700" />
                    <StatBadge value={stats.PF + stats.UF + stats.TF} label="Faltas" color="bg-red-500" />
                </div>
                
                <div className="space-y-4 py-2 max-h-[50vh] overflow-y-auto">
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

    const onCourtPlayers = team.playersOnCourt.map(pId => team.players.find(p => p.id === pId)).filter(Boolean) as Player[];
    const benchPlayers = team.players.filter(p => !team.playersOnCourt.includes(p.id) && !team.fouledOutPlayers.includes(p.id));

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
                 <div className="py-4 max-h-72 overflow-y-auto space-y-2">
                    {playersToList.map(player => (
                         <Button
                            key={player.id}
                            variant={selectedPlayerId === player.id ? 'default' : 'outline'}
                            className="w-full h-auto justify-start p-3 text-left"
                            onClick={() => setSelectedPlayerId(player.id)}
                        >
                            <span className="font-semibold text-base">#{player.number} {player.name}</span>
                        </Button>
                    ))}
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

const PlanSubstitutionModal = ({
    isOpen,
    onClose,
    onConfirm,
    teamId,
    game,
    title,
    confirmText
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (playersInIds: string[], playersOutIds: string[]) => void;
    teamId: 'homeTeam' | 'awayTeam';
    game: Game;
    title: string;
    confirmText: string;
}) => {
    if (!game) return null;

    const team = game[teamId];
    const [playersOut, setPlayersOut] = useState<Set<string>>(new Set());
    const [playersIn, setPlayersIn] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setPlayersIn(new Set());
            setPlayersOut(new Set());
        }
    }, [isOpen]);
    
    const onCourtPlayers = team.playersOnCourt.map(pId => team.players.find(p => p.id === pId)).filter(Boolean) as Player[];
    const benchPlayers = team.players.filter(p => !team.playersOnCourt.includes(p.id) && !team.fouledOutPlayers.includes(p.id));

    const handleToggleSelection = (id: string, list: 'in' | 'out') => {
        const updater = list === 'in' ? setPlayersIn : setPlayersOut;
        updater(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        onConfirm(Array.from(playersIn), Array.from(playersOut));
        onClose();
    };

    const isValidSelection = playersIn.size > 0 && playersIn.size === playersOut.size;

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{title} - {team.name}</DialogTitle>
                    <DialogDescription>
                        Selecciona los jugadores que salen de la cancha y los que entran desde la banca. El número de jugadores debe ser el mismo.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-4">
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Saliendo de la Cancha ({playersOut.size})</h3>
                        <ScrollArea className="h-80 rounded-md border p-2">
                            <div className="space-y-2">
                                {onCourtPlayers.map(player => (
                                    <Button
                                        key={player.id}
                                        variant={playersOut.has(player.id) ? 'default' : 'outline'}
                                        className="w-full justify-start h-auto p-2"
                                        onClick={() => handleToggleSelection(player.id, 'out')}
                                    >
                                        <span className="font-semibold">#{player.number} {player.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg mb-2">Entrando a la Cancha ({playersIn.size})</h3>
                        <ScrollArea className="h-80 rounded-md border p-2">
                             <div className="space-y-2">
                                {benchPlayers.map(player => (
                                    <Button
                                        key={player.id}
                                        variant={playersIn.has(player.id) ? 'default' : 'outline'}
                                        className="w-full justify-start h-auto p-2"
                                        onClick={() => handleToggleSelection(player.id, 'in')}
                                    >
                                        <span className="font-semibold">#{player.number} {player.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleConfirm} disabled={!isValidSelection}>
                        {confirmText} {playersIn.size > 0 && `(${playersIn.size})`}
                    </Button>
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
    onResetTime,
    currentTime,
    disabled = false
}: {
    isOpen: boolean;
    onClose: () => void;
    onAdjustTime: (seconds: number) => void;
    onSetTime: (seconds: number) => void;
    onResetTime: () => void;
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

    const handleResetTime = () => {
        onResetTime();
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
                     <div className="border-t pt-4">
                        <Button variant="destructive" className="w-full" onClick={handleResetTime} disabled={disabled}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar Tiempo del Periodo
                        </Button>
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

const FoulIndicator = ({ totalFouls, currentFouls }: { totalFouls: number, currentFouls: number }) => {
    return (
        <div className="flex items-center justify-center gap-1.5 h-4">
            {Array.from({ length: totalFouls }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        'h-2 w-4 rounded-sm',
                        i < currentFouls ? 'bg-destructive' : 'bg-muted'
                    )}
                />
            ))}
        </div>
    );
};

const ScoreboardCard = memo(({ team, teamId, game, onTimeout, canCallTimeout, isTimeoutActiveForTeam, onSetPossession }: { 
    team: Game['homeTeam'], 
    teamId: 'homeTeam' | 'awayTeam',
    game: Game,
    onTimeout: () => void,
    canCallTimeout: boolean,
    isTimeoutActiveForTeam: boolean,
    onSetPossession: (teamId: 'homeTeam' | 'awayTeam') => void
}) => {
    const currentQuarterIndex = game.currentQuarter - 1;
    const currentFouls = team.stats.foulsByQuarter?.[currentQuarterIndex] || 0;
    const totalFoulsForBonus = game.settings.foulsToBonus;
    const hasPossession = game.possessionArrowHolder === teamId;
    const isClickable = !game.clockIsRunning;

    return (
        <Card className="text-center p-2 sm:p-3 flex-1">
            <div className="flex items-center justify-between gap-2">
                <CardTitle 
                    className={cn(
                        "text-base sm:text-lg truncate flex-1 text-left flex items-center gap-2",
                        isClickable && "cursor-pointer"
                    )}
                    onClick={() => isClickable && onSetPossession(teamId)}
                >
                    <div className={cn("h-3 w-3 rounded-full transition-all", hasPossession ? "bg-primary" : "bg-muted")} />
                    <span className="truncate">{team.name}</span>
                </CardTitle>
                <Button
                    size="icon"
                    variant={isTimeoutActiveForTeam ? "destructive" : "outline"}
                    className={cn(
                        "h-8 w-auto px-2", 
                        isTimeoutActiveForTeam && "bg-orange-600 hover:bg-orange-700"
                    )}
                    onClick={onTimeout}
                    disabled={!canCallTimeout}
                >
                    <Timer className="h-4 w-4" />
                    <span className="ml-1 font-semibold">({team.stats.timeouts})</span>
                </Button>
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-primary my-1">{team.stats.score}</div>
            <div className="flex justify-center items-center gap-2">
                 <FoulIndicator totalFouls={totalFoulsForBonus} currentFouls={currentFouls} />
                {team.stats.inBonus && <Badge variant="destructive" className="animate-pulse text-xs px-1.5 py-0.5"><ShieldAlert className="h-3 w-3 mr-0.5"/>B</Badge>}
            </div>
        </Card>
    );
});
ScoreboardCard.displayName = 'ScoreboardCard';

const TeamPanel = memo(({ 
    team, 
    teamId, 
    game, 
    onStatClick, 
    onOpenModal, 
    onOpenSubModal, 
    onOpenMultipleSubModal, 
    onMoveToCourt, 
    showPlayerStatsSummary, 
    onToggleSummary,
    onPlanSubstitution,
    plannedSubstitutions,
    onExecutePlannedSub,
    onCancelPlannedSub
}: { 
    team: Game['homeTeam'], 
    teamId: 'homeTeam' | 'awayTeam', 
    game: Game,
    onStatClick: (teamId: 'homeTeam' | 'awayTeam', player: Player, stat: StatType, value: number) => void,
    onOpenModal: (teamId: 'homeTeam' | 'awayTeam', player: Player) => void,
    onOpenSubModal: (teamId: 'homeTeam' | 'awayTeam', player: Player, mode: 'in' | 'out') => void,
    onOpenMultipleSubModal: (teamId: 'homeTeam' | 'awayTeam') => void;
    onMoveToCourt: (teamId: 'homeTeam' | 'awayTeam', player: Player) => void,
    showPlayerStatsSummary: boolean,
    onToggleSummary: () => void,
    onPlanSubstitution: (teamId: 'homeTeam' | 'awayTeam') => void;
    plannedSubstitutions: { in: string[], out: string[] } | null;
    onExecutePlannedSub: (teamId: 'homeTeam' | 'awayTeam') => void;
    onCancelPlannedSub: (teamId: 'homeTeam' | 'awayTeam') => void;
}) => {
    if (!team || !team.players) return null;
    
    const playerMap = new Map(team.players.map(p => [p.id, p]));
    const onCourtPlayers = team.playersOnCourt.map(playerId => playerMap.get(playerId)).filter(Boolean) as Player[];

    const benchPlayers = team.players.filter(p => !team.playersOnCourt.includes(p.id) && !team.fouledOutPlayers.includes(p.id));
    
    const hasPlannedSub = plannedSubstitutions && plannedSubstitutions.in.length > 0;

    return (
        <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2 gap-2">
                <h3 className="text-lg font-semibold text-muted-foreground">En Cancha ({onCourtPlayers.length})</h3>
                <div className="flex gap-2">
                    {hasPlannedSub ? (
                        <div className="flex gap-1">
                            <Button variant="secondary" size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onExecutePlannedSub(teamId)}>
                                <ClipboardCheck className="mr-2 h-4 w-4" /> Ejecutar ({plannedSubstitutions.in.length})
                            </Button>
                             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onCancelPlannedSub(teamId)}>
                                <XCircle className="h-5 w-5" />
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => onPlanSubstitution(teamId)}>
                            <ClipboardList className="mr-2 h-4 w-4" /> Planificar
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onOpenMultipleSubModal(teamId)}>
                        <Users className="mr-2 h-4 w-4" /> Múltiple
                    </Button>
                </div>
              </div>
              <div className="space-y-2">
                {onCourtPlayers.map(player => {
                    const playerStats = team.playerStats[player.id];
                    const totalFouls = playerStats.PF + playerStats.UF + playerStats.TF;
                    
                    const foulLimit = game.settings.foulsToFoulOut;
                    const inFoulTrouble = game.settings.allowFoulOut && (foulLimit - totalFouls <= 2);
                    
                    const lastAction = game.gameLog[game.gameLog.length - 1];
                    const lastActionKey = lastAction?.payload?.playerId === player.id ? `${player.id}-${lastAction.payload.statType}` : null;


                    return (
                        <PlayerStatsInput 
                            key={player.id} 
                            player={player} 
                            playerStats={playerStats}
                            onStatClick={(stat, value) => onStatClick(teamId, player, stat, value)}
                            onOpenModal={() => onOpenModal(teamId, player)}
                            onSubstitute={() => onOpenSubModal(teamId, player, 'out')}
                            lastActionKey={lastActionKey}
                            inFoulTrouble={inFoulTrouble}
                            showSummary={showPlayerStatsSummary}
                            onToggleSummary={onToggleSummary}
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
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenModal(teamId, player)}>
                                      <BarChartHorizontal className="h-5 w-5" />
                                  </Button>
                               </div>
                               <Button size="sm" variant="outline" onClick={() => onMoveToCourt(teamId, player)}>
                                    <UserCog className="mr-2 h-4 w-4" /> Mover a la cancha
                                </Button>
                           </div>
                       </Card>
                    ))}
                </div>
            </div>
        </div>
    );
});
TeamPanel.displayName = 'TeamPanel'
  
const PlayByPlayContent = memo(({ game, formatActionTime }: { game: Game, formatActionTime: (action: GameAction) => string }) => {
    return (
        <>
            {game.gameLog.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Aún no hay acciones registradas.</p>
            ) : (
                <ScrollArea className="h-[400px] px-6">
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
        </>
    )
});
PlayByPlayContent.displayName = 'PlayByPlayContent'


const FollowUpActionModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    followUpState, 
    game 
}: { 
    isOpen: boolean; 
    onClose: () => void;
    onConfirm: (secondaryPlayerId: string, secondaryStat: StatType) => void;
    followUpState: FollowUpActionState;
    game: Game;
}) => {
    if (!followUpState || !game) return null;
    
    const [shotType, setShotType] = useState<"2PA" | "3PA">("2PA");

    useEffect(() => {
        if (isOpen) {
            setShotType("2PA");
        }
    }, [isOpen]);

    const getModalConfig = () => {
        const { type, primaryAction, teamId } = followUpState;
        
        switch (type) {
            case 'assist': {
                const team = game[teamId];
                const scorerId = primaryAction.payload.playerId;
                return {
                    title: '¿Quién dio la asistencia?',
                    description: 'Selecciona el jugador que realizó la asistencia.',
                    playersToList: team.players.filter(p => p.id !== scorerId && team.playersOnCourt.includes(p.id)),
                    showShotTypeSelection: false
                };
            }
            case 'steal': {
                const opponentTeamId = teamId === 'homeTeam' ? 'awayTeam' : 'homeTeam';
                const opponentTeam = game[opponentTeamId];
                return {
                    title: '¿Quién perdió el balón?',
                    description: 'Selecciona el jugador del equipo contrario que perdió el balón.',
                    playersToList: opponentTeam.players.filter(p => opponentTeam.playersOnCourt.includes(p.id)),
                    showShotTypeSelection: false
                };
            }
            case 'block': {
                const opponentTeamId = teamId === 'homeTeam' ? 'awayTeam' : 'homeTeam';
                const opponentTeam = game[opponentTeamId];
                return {
                    title: '¿Quién intentó el tiro?',
                    description: 'Selecciona el jugador del equipo contrario cuyo tiro fue taponado.',
                    playersToList: opponentTeam.players.filter(p => opponentTeam.playersOnCourt.includes(p.id)),
                    showShotTypeSelection: true
                };
            }
            default:
                return { title: '', description: '', playersToList: [], showShotTypeSelection: false };
        }
    };

    const { title, description, playersToList, showShotTypeSelection } = getModalConfig();

    const handleConfirmClick = (selectedPlayerId: string) => {
        let secondaryStat: StatType = 'AST'; // Default
        if (followUpState.type === 'steal') secondaryStat = 'TOV';
        if (followUpState.type === 'block') secondaryStat = shotType;

        onConfirm(selectedPlayerId, secondaryStat);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                
                {showShotTypeSelection && (
                    <div className="py-2">
                        <Label>Tipo de Tiro Intendado</Label>
                        <RadioGroup value={shotType} onValueChange={(val) => setShotType(val as "2PA" | "3PA")} className="flex gap-4 mt-2">
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="2PA" id="2pa-option" />
                                <Label htmlFor="2pa-option">Tiro de 2 Puntos</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="3PA" id="3pa-option" />
                                <Label htmlFor="3pa-option">Tiro de 3 Puntos</Label>
                            </div>
                        </RadioGroup>
                    </div>
                )}
                
                <div className="py-4 max-h-72 overflow-y-auto space-y-2">
                    {playersToList.map(player => (
                        <Button 
                            key={player.id} 
                            variant="outline"
                            className="w-full h-auto justify-start p-3 text-left"
                            onClick={() => handleConfirmClick(player.id)}
                        >
                            <span className="font-semibold text-base">#{player.number} {player.name}</span>
                        </Button>
                    ))}
                </div>
                <DialogFooter>
                     <Button type="button" variant="secondary" onClick={onClose}>Saltar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};


export default function LiveGamePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState<EditingPlayerInfo | null>(null);
  const [substitutionState, setSubstitutionState] = useState<SubstitutionState>(null);
  const [multipleSubModalTeam, setMultipleSubModalTeam] = useState<'homeTeam' | 'awayTeam' | null>(null);
  const [planSubModalTeam, setPlanSubModalTeam] = useState<'homeTeam' | 'awayTeam' | null>(null);
  const [plannedSubstitutions, setPlannedSubstitutions] = useState<Record<'homeTeam' | 'awayTeam', { in: string[], out: string[] } | null>>({ homeTeam: null, awayTeam: null });

  const [followUpAction, setFollowUpAction] = useState<FollowUpActionState>(null);
  const [teamsSwapped, setTeamsSwapped] = useState(false);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [isFinishingGame, setIsFinishingGame] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [showGameControls, setShowGameControls] = useState(true);
  const [showPlayerStatsSummary, setShowPlayerStatsSummary] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialGameStateRef = useRef<Game | null>(null);

  // Swipe to swap teams state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;


  // Load game from DB on initial mount
  useEffect(() => {
      async function loadGame() {
          if (typeof window === 'undefined') return;
          try {
              let liveGame = await getLiveGame();
              if (liveGame) {
                  // Data migration for older game objects
                  liveGame = produce(liveGame, draft => {
                      if (!draft.homeTeam.fouledOutPlayers) {
                          draft.homeTeam.fouledOutPlayers = [];
                      }
                      if (!draft.awayTeam.fouledOutPlayers) {
                          draft.awayTeam.fouledOutPlayers = [];
                      }
                       if (draft.possessionArrowHolder === undefined) {
                          draft.possessionArrowHolder = null;
                      }
                  });
                  // Store a deep copy of the initial state for the undo logic
                  initialGameStateRef.current = JSON.parse(JSON.stringify(liveGame));
                  setGame(liveGame);
                  setActiveTab(liveGame.homeTeam.id);
              } else {
                  router.replace('/game/setup');
              }
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
  
  // Game clock tick effect
  useEffect(() => {
    const stopClock = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };
    
    const startClock = () => {
        stopClock(); // Ensure no multiple intervals are running
        intervalRef.current = setInterval(() => {
            setGame(currentGame => {
                if (!currentGame || (!currentGame.clockIsRunning && !currentGame.isTimeoutActive)) {
                    stopClock();
                    return currentGame;
                }
                
                const newGame = applyActionToGameState(currentGame, { type: 'TICK', payload: {} } as GameAction, false);
                
                if (Math.round(newGame.gameClock) % 5 === 0) {
                   saveLiveGame(newGame);
                }
                return newGame;
            });
        }, 1000);
    };

    if (game && (game.clockIsRunning || game.isTimeoutActive)) {
        startClock();
    } else {
        stopClock();
    }

    return () => stopClock();
  }, [game?.clockIsRunning, game?.isTimeoutActive]);

  const dispatchAction = useCallback((type: GameAction['type'], payload: GameAction['payload']) => {
      setGame(currentGame => {
          if (!currentGame) return null;
          const action = { type, payload } as GameAction;
          const newGame = applyActionToGameState(currentGame, action, true);
          
          const lastAction = newGame.gameLog[newGame.gameLog.length - 1];

           // Handle follow-up actions (assist, steal, block)
            if (lastAction) {
                const { payload: lastPayload } = lastAction;
                if (lastPayload.statType === '2PM' || lastPayload.statType === '3PM') {
                    setFollowUpAction({
                        type: 'assist',
                        primaryAction: lastAction,
                        teamId: lastPayload.teamId!,
                        playerId: lastPayload.playerId!,
                    });
                } else if (lastPayload.statType === 'STL') {
                    setFollowUpAction({
                        type: 'steal',
                        primaryAction: lastAction,
                        teamId: lastPayload.teamId!,
                        playerId: lastPayload.playerId!,
                    });
                } else if (lastPayload.statType === 'BLK') {
                    setFollowUpAction({
                        type: 'block',
                        primaryAction: lastAction,
                        teamId: lastPayload.teamId!,
                        playerId: lastPayload.playerId!,
                    });
                }
            }


          // Check for foul-out after the action is applied
          if (lastAction?.payload?.isFoulOut) {
              toast({
                  title: "¡Jugador Expulsado!",
                  description: `${lastAction.description}. Por favor, realiza una sustitución.`,
                  variant: "destructive",
                  duration: 5000,
              });
              setSubstitutionState({
                  teamId: lastAction.payload.teamId!,
                  playerOutId: lastAction.payload.playerId!,
                  mode: 'out',
              });
          }

          saveLiveGame(newGame);
          return newGame;
      });
  }, [toast]);

  const handleFinishGame = useCallback(async () => {
    if (typeof window === 'undefined' || isFinishingGame || !game) return;

    setIsFinishingGame(true);
    
    try {
        const finalGameAction = { type: 'GAME_END', payload: {} } as GameAction;
        const finishedGame = applyActionToGameState(game, finalGameAction, true);
        
        let tournamentToUpdate: Tournament | undefined;
        if (finishedGame.tournamentId && finishedGame.matchId) {
            // This is a tournament match, prepare the tournament data for the batch write.
            // We use the game state directly, assuming it's the source of truth,
            // to avoid a read that would fail offline.
            const originalTournament = await getTournamentById(finishedGame.tournamentId);

            if (originalTournament) {
                tournamentToUpdate = produce(originalTournament, (draft: Tournament) => {
                    const matchIndex = draft.matches.findIndex(m => m.id === finishedGame.matchId);
                    if (matchIndex !== -1) {
                         draft.matches[matchIndex].status = 'FINISHED';
                         draft.matches[matchIndex].team1.score = finishedGame.homeTeam.stats.score;
                         draft.matches[matchIndex].team2.score = finishedGame.awayTeam.stats.score;
                         draft.matches[matchIndex].gameId = finishedGame.id;
                    }
                });
            }
        }
        
        // Use the atomic batch operation to save everything.
        await finishAndSaveGameBatch(finishedGame, tournamentToUpdate);

        if (tournamentToUpdate) {
            toast({
                title: "Partido de Torneo Finalizado",
                description: "Los resultados han sido guardados en el torneo y en el historial general.",
            });
        } else {
             toast({
                title: "Partido Guardado",
                description: "El partido ha sido guardado en el historial general.",
            });
        }
        
        const destination = finishedGame.tournamentId ? `/stats?tournamentId=${finishedGame.tournamentId}` : '/history';
        router.push(destination);

    } catch (error) {
        console.error("Error finishing game: ", error);
        toast({
            title: "Error al guardar",
            description: "No se pudo guardar el partido. Inténtalo de nuevo.",
            variant: 'destructive',
        });
        setIsFinishingGame(false);
    }
  }, [game, isFinishingGame, router, toast]);

    const handleTimerControl = useCallback((timerState: 'PLAY' | 'PAUSE') => {
      dispatchAction('TIMER_CHANGE', { timerState });
  }, [dispatchAction]);
  
  const handleStatClick = useCallback((teamId: 'homeTeam' | 'awayTeam', player: Player, stat: StatType, value: number) => {
    const actionType = value > 0 ? 'SCORE_UPDATE' : 'STAT_UPDATE';
    dispatchAction(actionType, {
            teamId,
            playerId: player.id,
            statType: stat,
            pointsScored: value
    });
  }, [dispatchAction]);


  const handleDetailedStatChange = useCallback((playerId: string, teamId: 'homeTeam' | 'awayTeam', stat: StatType, adjustment: 1 | -1) => {
    const actionType = (stat === '1PM' || stat === '2PM' || stat === '3PM') ? 'SCORE_UPDATE' : 'STAT_UPDATE';
    dispatchAction(actionType, {
            teamId,
            playerId,
            statType: stat,
            manualAdjustment: adjustment
    });
  }, [dispatchAction]);

   const handleConfirmFollowUp = useCallback((secondaryPlayerId: string, secondaryStat: StatType) => {
        if (!followUpAction) return;

        const { type, teamId } = followUpAction;
        let secondaryTeamId: 'homeTeam' | 'awayTeam';
        let actionType: 'STAT_UPDATE' | 'SCORE_UPDATE' = 'STAT_UPDATE';

        if (type === 'assist') {
            secondaryTeamId = teamId;
        } else { // steal or block
            secondaryTeamId = teamId === 'homeTeam' ? 'awayTeam' : 'homeTeam';
        }
        
        dispatchAction(actionType, {
            teamId: secondaryTeamId,
            playerId: secondaryPlayerId,
            statType: secondaryStat,
            pointsScored: 0, // This is not a scoring play
        });

        setFollowUpAction(null);
    }, [followUpAction, dispatchAction]);

  const handleOpenModal = useCallback((teamId: 'homeTeam' | 'awayTeam', player: Player) => {
    setEditingPlayer({
        teamId: teamId,
        playerId: player.id,
    });
  }, []);

    const handleOpenSubstitutionModal = useCallback((teamId: 'homeTeam' | 'awayTeam', player: Player, mode: 'in' | 'out') => {
        if (mode === 'in') {
            setSubstitutionState({ teamId, playerInId: player.id, playerOutId: undefined, mode: 'in' });
        } else {
            setSubstitutionState({ teamId, playerInId: undefined, playerOutId: player.id, mode: 'out' });
        }
    }, []);

    const handleOpenMultipleSubModal = useCallback((teamId: 'homeTeam' | 'awayTeam') => {
        setMultipleSubModalTeam(teamId);
    }, []);

    const handleMovePlayerToCourt = useCallback((teamId: 'homeTeam' | 'awayTeam', player: Player) => {
        if(!game) return;
        const team = game[teamId];
        if (team.playersOnCourt.length >= 5) {
            handleOpenSubstitutionModal(teamId, player, 'in');
        } else {
            dispatchAction('ADD_PLAYER_TO_COURT', { teamId, playerInId: player.id });
        }
    }, [game, dispatchAction, handleOpenSubstitutionModal]);

    const handleConfirmSubstitution = useCallback((playerInId: string, playerOutId: string) => {
        if (!substitutionState) return;
        const { teamId } = substitutionState;
        dispatchAction('SUBSTITUTION', { teamId, playerInId, playerOutId });
        setSubstitutionState(null);
    }, [substitutionState, dispatchAction]);

    const handleConfirmMultipleSubstitution = useCallback((playersInIds: string[], playersOutIds: string[]) => {
        if (!multipleSubModalTeam) return;
        dispatchAction('MULTIPLE_SUBSTITUTION', { teamId: multipleSubModalTeam, playersInIds, playersOutIds });
        setMultipleSubModalTeam(null);
    }, [multipleSubModalTeam, dispatchAction]);

    const handleConfirmPlanSubstitution = useCallback((playersInIds: string[], playersOutIds: string[]) => {
        if (!planSubModalTeam) return;
        setPlannedSubstitutions(prev => ({
            ...prev,
            [planSubModalTeam]: { in: playersInIds, out: playersOutIds }
        }));
        setPlanSubModalTeam(null);
    }, [planSubModalTeam]);

    const handleExecutePlannedSub = (teamId: 'homeTeam' | 'awayTeam') => {
        const planned = plannedSubstitutions[teamId];
        if (!planned || planned.in.length === 0) return;
        
        dispatchAction('MULTIPLE_SUBSTITUTION', { teamId: teamId, playersInIds: planned.in, playersOutIds: planned.out });

        // Reset the plan for that team
        setPlannedSubstitutions(prev => ({
            ...prev,
            [teamId]: null
        }));
    };
    
    const handleCancelPlannedSub = (teamId: 'homeTeam' | 'awayTeam') => {
        setPlannedSubstitutions(prev => ({
            ...prev,
            [teamId]: null
        }));
    };


  const handleChangeQuarter = useCallback((direction: 'next' | 'prev') => {
      if(!game) return;
      let newQuarter = game.currentQuarter;
      if (direction === 'next') {
          newQuarter = game.currentQuarter + 1;
      } else {
          newQuarter = Math.max(1, game.currentQuarter - 1);
      }

      if (newQuarter !== game.currentQuarter) {
           dispatchAction('QUARTER_CHANGE', { newQuarter });
      }
  }, [game, dispatchAction])

  const handleManualTimeChange = useCallback((timeAdjustment: number) => {
    dispatchAction('MANUAL_TIMER_ADJUST', { timeAdjustment });
    toast({
        title: "Reloj Ajustado",
        description: `Se han ${timeAdjustment > 0 ? 'añadido' : 'restado'} ${Math.abs(timeAdjustment)} segundos.`
    });
  }, [dispatchAction, toast]);

  const handleSetTime = useCallback((newTime: number) => {
    dispatchAction('SET_TIMER', { newTime });
    toast({
        title: "Reloj Establecido",
        description: `El tiempo se ha establecido a ${Math.floor(newTime / 60)}:${(newTime % 60).toString().padStart(2, '0')}`
    });
  }, [dispatchAction, toast]);

  const handleResetTime = useCallback(() => {
    dispatchAction('TIMER_RESET', {});
    toast({
        title: "Reloj Reiniciado",
        description: "El tiempo se ha reiniciado al valor del periodo actual."
    });
  }, [dispatchAction, toast]);


  const handleTimeout = useCallback((teamId: 'homeTeam' | 'awayTeam') => {
    dispatchAction('TIMEOUT', { teamId });
  }, [dispatchAction])

  const handleUndo = useCallback(() => {
    if (game && game.gameLog.length > 0 && initialGameStateRef.current) {
        const newLog = game.gameLog.slice(0, -1);
        const clockStateToPreserve = {
            gameClock: game.gameClock,
            clockIsRunning: game.clockIsRunning,
            isTimeoutActive: game.isTimeoutActive,
            timeoutClock: game.timeoutClock,
            timeoutCaller: game.timeoutCaller,
        };
        const newGame = recalculateGameStateFromLog(initialGameStateRef.current, newLog, clockStateToPreserve);
        setGame(newGame);
        saveLiveGame(newGame);
        toast({
            title: "Acción deshecha",
            description: "Se ha revertido la última acción del partido."
        });
    }
  }, [game, toast])

  const handleExportPlayByPlay = useCallback(() => {
    if (!game || game.gameLog.length === 0) return;
    exportPlayByPlayToCsv(game);
     toast({
        title: 'Play-by-Play Exportado',
        description: 'El historial de jugadas se ha guardado en un archivo CSV.',
    });
  }, [game, toast]);
  
  const handleSwapTeams = useCallback(() => {
    if (!game) return;
    const newSwappedState = !teamsSwapped;
    setTeamsSwapped(newSwappedState);

    // Sync tabs on mobile
    setActiveTab(currentTab => {
        if (currentTab === game.homeTeam.id) {
            return game.awayTeam.id;
        }
        if (currentTab === game.awayTeam.id) {
            return game.homeTeam.id;
        }
        return currentTab;
    });
}, [game, teamsSwapped]);

  const formatActionTime = useCallback((action: GameAction) => {
        if (!game) return '';
        const { payload } = action;
        const quarter = payload.quarter ?? game.currentQuarter;
        const gameClock = payload.gameClock ?? 0;
        const homeScore = payload.homeScore ?? 0;
        const awayScore = payload.awayScore ?? 0;
    
        const mins = Math.floor(gameClock / 60).toString().padStart(2, '0');
        const secs = (gameClock % 60).toString().padStart(2, '0');
        return `P${quarter} ${mins}:${secs} (${homeScore} - ${awayScore})`;
    }, [game]);
    
    const handleSetPossession = (teamId: 'homeTeam' | 'awayTeam') => {
        if (game?.clockIsRunning) return;
        dispatchAction('SET_POSSESSION_ARROW', { teamId });
    };

  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null); // otherwise the swipe is fired even with usual touch events
      setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
      if (!touchStart || !touchEnd || !game) return;
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;
      if (isLeftSwipe) {
          setActiveTab(activeTab === game.homeTeam.id ? game.awayTeam.id : game.homeTeam.id);
      }
      if (isRightSwipe) {
          setActiveTab(activeTab === game.awayTeam.id ? game.homeTeam.id : game.awayTeam.id);
      }
      setTouchStart(null);
      setTouchEnd(null);
  };

  if (isLoading || !game) {
    return <LoadingModal />;
  }

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
      const { minutes, seconds } = formatClock(clock);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  const canCallTimeout = (teamId: 'homeTeam' | 'awayTeam') => {
      const team = game[teamId];
      if (game.isTimeoutActive) {
          return game.timeoutCaller === teamId;
      }
      return team.stats.timeouts > 0;
  }

  return (
    <>
    {isFinishingGame && <LoadingModal text="Finalizando y guardando..." />}
    <div 
      className="container mx-auto px-2 sm:px-4 py-4 sm:py-8"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm -mx-4 px-4 pt-4 pb-2 mb-4">
        <Card className="mb-4 sm:mb-6 bg-card text-card-foreground shadow-lg">
          <CardContent className="p-2 sm:p-4 flex flex-col gap-3 items-center">
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                  
                  <ScoreboardCard 
                    team={team1Scoreboard} 
                    teamId={team1Data.teamId}
                    game={game} 
                    onTimeout={() => handleTimeout(team1Data.teamId)}
                    canCallTimeout={canCallTimeout(team1Data.teamId)}
                    isTimeoutActiveForTeam={game.isTimeoutActive && game.timeoutCaller === team1Data.teamId}
                    onSetPossession={handleSetPossession}
                  />
                  
                  <div className="text-center group relative px-2 order-first sm:order-none w-full sm:w-auto">
                      <p className="text-muted-foreground font-semibold text-sm sm:text-base">{getPeriodDisplay()}</p>
                      <div className={cn("text-4xl sm:text-6xl font-mono font-bold tracking-tight my-0.5", game.isTimeoutActive ? 'text-orange-500' : 'text-primary')}>
                          {getClockDisplay()}
                      </div>
                       <div className="flex justify-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowGameControls(!showGameControls)}>
                             {showGameControls ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                             <span className="sr-only">{showGameControls ? 'Ocultar controles' : 'Mostrar controles'}</span>
                         </Button>
                       </div>
                  </div>

                   <ScoreboardCard 
                        team={team2Scoreboard} 
                        teamId={team2Data.teamId}
                        game={game}
                        onTimeout={() => handleTimeout(team2Data.teamId)}
                        canCallTimeout={canCallTimeout(team2Data.teamId)}
                        isTimeoutActiveForTeam={game.isTimeoutActive && game.timeoutCaller === team2Data.teamId}
                        onSetPossession={handleSetPossession}
                    />

              </div>
              
              {showGameControls && (
                <>
                <Separator className="my-2" />
                <div className="flex items-center justify-center gap-1 sm:gap-2 w-full max-w-md">
                    <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={handleSwapTeams}>
                        <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="sr-only">Intercambiar equipos</span>
                    </Button>
                     <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => setIsClockModalOpen(true)} disabled={game.clockIsRunning || game.isTimeoutActive}>
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Ajustes del Reloj</span>
                    </Button>
                    <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => handleChangeQuarter('prev')} disabled={game.clockIsRunning || game.isTimeoutActive}>
                        <ChevronLeft className="h-5 w-5"/>
                        <span className="sr-only">Periodo Anterior</span>
                    </Button>
                    <Button size="icon" className="bg-green-600 hover:bg-green-700 text-white h-10 w-10 sm:h-11 sm:w-11" onClick={() => handleTimerControl(game.clockIsRunning ? 'PAUSE' : 'PLAY')} disabled={game.isTimeoutActive}>
                        {game.clockIsRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        <span className="sr-only">{game.clockIsRunning ? "Pausar" : "Iniciar"}</span>
                    </Button>
                    <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => handleChangeQuarter('next')} disabled={game.clockIsRunning || game.isTimeoutActive}>
                        <ChevronRight className="h-5 w-5"/>
                        <span className="sr-only">Periodo Siguiente</span>
                    </Button>
                    <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={handleUndo} disabled={game.gameLog.length === 0}>
                        <Undo className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="sr-only">Deshacer última acción</span>
                    </Button>
                </div>
                </>
              )}
          </CardContent>
        </Card>
      </div>
      
      <div className="lg:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1.5">
                <TabsTrigger 
                    value={game.homeTeam.id}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                    {game.homeTeam.name}
                </TabsTrigger>
                <TabsTrigger 
                    value={game.awayTeam.id}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                    {game.awayTeam.name}
                </TabsTrigger>
            </TabsList>
            <TabsContent value={game.homeTeam.id} className="mt-4">
                <TeamPanel 
                    team={game.homeTeam} 
                    teamId={'homeTeam'} 
                    game={game}
                    onStatClick={handleStatClick}
                    onOpenModal={handleOpenModal}
                    onOpenSubModal={handleOpenSubstitutionModal}
                    onOpenMultipleSubModal={handleOpenMultipleSubModal}
                    onMoveToCourt={handleMovePlayerToCourt}
                    showPlayerStatsSummary={showPlayerStatsSummary}
                    onToggleSummary={() => setShowPlayerStatsSummary(s => !s)}
                    onPlanSubstitution={() => setPlanSubModalTeam('homeTeam')}
                    plannedSubstitutions={plannedSubstitutions.homeTeam}
                    onExecutePlannedSub={handleExecutePlannedSub}
                    onCancelPlannedSub={handleCancelPlannedSub}
                />
            </TabsContent>
            <TabsContent value={game.awayTeam.id} className="mt-4">
                <TeamPanel 
                    team={game.awayTeam} 
                    teamId={'awayTeam'} 
                    game={game}
                    onStatClick={handleStatClick}
                    onOpenModal={handleOpenModal}
                    onOpenSubModal={handleOpenSubstitutionModal}
                    onOpenMultipleSubModal={handleOpenMultipleSubModal}
                    onMoveToCourt={handleMovePlayerToCourt}
                    showPlayerStatsSummary={showPlayerStatsSummary}
                    onToggleSummary={() => setShowPlayerStatsSummary(s => !s)}
                     onPlanSubstitution={() => setPlanSubModalTeam('awayTeam')}
                    plannedSubstitutions={plannedSubstitutions.awayTeam}
                    onExecutePlannedSub={handleExecutePlannedSub}
                    onCancelPlannedSub={handleCancelPlannedSub}
                />
            </TabsContent>
        </Tabs>
        </div>

      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-8">
           <TeamPanel 
                team={team1Data.team} 
                teamId={team1Data.teamId} 
                game={game}
                onStatClick={handleStatClick}
                onOpenModal={handleOpenModal}
                onOpenSubModal={handleOpenSubstitutionModal}
                onOpenMultipleSubModal={handleOpenMultipleSubModal}
                onMoveToCourt={handleMovePlayerToCourt}
                showPlayerStatsSummary={showPlayerStatsSummary}
                onToggleSummary={() => setShowPlayerStatsSummary(s => !s)}
                onPlanSubstitution={() => setPlanSubModalTeam(team1Data.teamId)}
                plannedSubstitutions={plannedSubstitutions[team1Data.teamId]}
                onExecutePlannedSub={handleExecutePlannedSub}
                onCancelPlannedSub={handleCancelPlannedSub}
            />
             <TeamPanel 
                team={team2Data.team} 
                teamId={team2Data.teamId} 
                game={game}
                onStatClick={handleStatClick}
                onOpenModal={handleOpenModal}
                onOpenSubModal={handleOpenSubstitutionModal}
                onOpenMultipleSubModal={handleOpenMultipleSubModal}
                onMoveToCourt={handleMovePlayerToCourt}
                showPlayerStatsSummary={showPlayerStatsSummary}
                onToggleSummary={() => setShowPlayerStatsSummary(s => !s)}
                onPlanSubstitution={() => setPlanSubModalTeam(team2Data.teamId)}
                plannedSubstitutions={plannedSubstitutions[team2Data.teamId]}
                onExecutePlannedSub={handleExecutePlannedSub}
                onCancelPlannedSub={handleCancelPlannedSub}
            />
      </div>


      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 my-6">
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
            <div className="flex items-center justify-between bg-muted px-4 rounded-t-md">
                <AccordionTrigger className="text-lg font-semibold flex-1 py-3">
                    <div className="flex items-center gap-2">
                        <ListCollapse className="h-5 w-5" />
                        Play-by-Play
                    </div>
                </AccordionTrigger>
                {game.gameLog.length > 0 && (
                    <Button 
                        onClick={handleExportPlayByPlay}
                        size="sm" 
                        variant="outline"
                        className="h-8"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Exportar (CSV)</span>
                        <span className="sm:hidden">CSV</span>
                    </Button>
                )}
            </div>
            <AccordionContent className="rounded-b-md border border-t-0 py-4">
                <PlayByPlayContent game={game} formatActionTime={formatActionTime} />
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
     {multipleSubModalTeam && (
        <PlanSubstitutionModal
            isOpen={!!multipleSubModalTeam}
            onClose={() => setMultipleSubModalTeam(null)}
            onConfirm={handleConfirmMultipleSubstitution}
            teamId={multipleSubModalTeam}
            game={game}
            title="Sustitución Múltiple"
            confirmText="Confirmar Sustituciones"
        />
     )}
     {planSubModalTeam && (
        <PlanSubstitutionModal
            isOpen={!!planSubModalTeam}
            onClose={() => setPlanSubModalTeam(null)}
            onConfirm={handleConfirmPlanSubstitution}
            teamId={planSubModalTeam}
            game={game}
            title="Planificar Sustitución"
            confirmText="Planificar Cambios"
        />
     )}
     <ClockSettingsModal
        isOpen={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
        onAdjustTime={handleManualTimeChange}
        onSetTime={handleSetTime}
        onResetTime={handleResetTime}
        currentTime={game.gameClock}
        disabled={game.clockIsRunning || game.isTimeoutActive}
    />
    <FollowUpActionModal
        isOpen={!!followUpAction}
        onClose={() => setFollowUpAction(null)}
        onConfirm={handleConfirmFollowUp}
        followUpState={followUpAction}
        game={game}
    />
    </>
  );
}

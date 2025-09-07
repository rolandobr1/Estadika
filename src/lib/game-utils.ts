

import type { Game, Player, TeamInGame, PlayerStats, GameAction, StatType, GameActionPayload } from '@/lib/types';
import { produce } from 'immer';
import { defaultAppSettings } from './types';

const statDetails: Record<string, { label: string }> = {
    '1PM': { label: 'Tiro Libre Anotado' },
    '2PM': { label: 'Canasta de 2 Puntos' },
    '3PM': { label: 'Canasta de 3 Puntos' },
    'AST': { label: 'Asistencia' },
    'STL': { label: 'Robo' },
    'BLK': { label: 'Tapón' },
    'PF': { label: 'Falta Personal' },
    'DREB': { label: 'Rebote Defensivo' },
    'UF': { label: 'Falta Antideportiva' },
    'TF': { label: 'Falta Técnica' },
    'OREB': { label: 'Rebote Ofensivo' },
    'TOV': { label: 'Pérdida' },
    '1PA': { label: 'Tiro Libre Fallado' },
    '2PA': { label: 'Tiro de 2 Puntos Fallado' },
    '3PA': { label: 'Tiro de 3 Puntos Fallado' },
};


/**
 * Creates a clean slate for a player's statistics.
 * @returns A PlayerStats object with all stats initialized to 0.
 */
export const createInitialPlayerStats = (): PlayerStats => ({
    '1PM': 0, '1PA': 0, '2PM': 0, '2PA': 0, '3PM': 0, '3PA': 0,
    REB: 0, DREB: 0, OREB: 0, AST: 0, STL: 0, BLK: 0, TOV: 0, PF: 0, UF: 0, TF: 0, PTS: 0
});

/**
 * Creates a team object for use within a game, including full player details and stats maps.
 * @param id - The team's unique ID.
 * @param name - The team's name.
 * @param players - An array of Player objects on this team.
 * @returns a TeamInGame object.
 */
export const createTeamInGame = (id: string, name: string, players: Player[], quarters: number): TeamInGame => ({
    id,
    name,
    players,
    stats: { 
        score: 0, 
        timeouts: 0, // This will be calculated based on game state
        foulsByQuarter: Array(quarters + 20).fill(0), // Increased size for many OTs
        inBonus: false,
    },
    playerStats: players.reduce((acc, player) => {
        acc[player.id] = createInitialPlayerStats();
        return acc;
    }, {} as Record<string, PlayerStats>),
    playersOnCourt: players.slice(0, 5).map(p => p.id),
    fouledOutPlayers: [],
});

/**
 * creates the entire initial state for a new game.
 * @returns a new Game object.
 */
export function createInitialGame(): Game {
    const settings = defaultAppSettings.gameSettings;

    const game: Game = {
        id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: Date.now(),
        homeTeam: createTeamInGame('homeTeam', 'Local', [], settings.quarters),
        awayTeam: createTeamInGame('awayTeam', 'Visitante', [], settings.quarters),
        gameLog: [],
        status: 'SETUP',
        currentQuarter: 1,
        gameClock: settings.quarterLength * 60, // Store in seconds from the start
        clockIsRunning: false,
        isTimeoutActive: false,
        timeoutClock: settings.timeoutLength,
        possessionArrowHolder: null,
        settings
    };

    const getInitialTimeouts = () => {
        const { timeoutSettings } = game.settings;
        switch (timeoutSettings.mode) {
            case 'per_quarter': return timeoutSettings.timeoutsPerQuarter;
            case 'per_quarter_custom': return timeoutSettings.timeoutsPerQuarterValues[0] ?? 0;
            case 'per_half': return timeoutSettings.timeoutsFirstHalf;
            case 'total': return timeoutSettings.timeoutsTotal;
            default: return 0;
        }
    };

    const initialTimeouts = getInitialTimeouts();
    game.homeTeam.stats.timeouts = initialTimeouts;
    game.awayTeam.stats.timeouts = initialTimeouts;

    return game;
}

type PreservedClockState = {
    gameClock: number;
    clockIsRunning: boolean;
    isTimeoutActive: boolean;
    timeoutClock: number;
    timeoutCaller?: 'homeTeam' | 'awayTeam';
};


/**
 * Recalculates the entire game state from the game log.
 * This is a pure function. Given the same initial state and log, it will always produce the same result.
 * @param initialGame - The initial state of the game (rosters, settings), before any actions were taken.
 * @param log - The array of GameAction events to process.
 * @returns A new Game object representing the calculated state.
 */
export function recalculateGameStateFromLog(initialGame: Game, log: GameAction[], clockStateToPreserve?: PreservedClockState): Game {
    
    // Create a clean state based on the initial game data (teams, settings)
    const cleanState = produce(initialGame, draft => {
        // Reset dynamic properties to a clean slate
        draft.homeTeam.playerStats = draft.homeTeam.players.reduce((acc, player) => {
            acc[player.id] = createInitialPlayerStats();
            return acc;
        }, {} as Record<string, PlayerStats>);

        draft.awayTeam.playerStats = draft.awayTeam.players.reduce((acc, player) => {
            acc[player.id] = createInitialPlayerStats();
            return acc;
        }, {} as Record<string, PlayerStats>);
        
         draft.homeTeam.stats.score = 0;
         draft.awayTeam.stats.score = 0;
         draft.homeTeam.stats.foulsByQuarter = Array(draft.settings.quarters + 20).fill(0);
         draft.awayTeam.stats.foulsByQuarter = Array(draft.settings.quarters + 20).fill(0);
         draft.homeTeam.stats.inBonus = false;
         draft.awayTeam.stats.inBonus = false;
         draft.homeTeam.fouledOutPlayers = [];
         draft.awayTeam.fouledOutPlayers = [];
         draft.possessionArrowHolder = null;
    });

    let recalculatedGame = cleanState;

    for (const action of log) {
        recalculatedGame = applyActionToGameState(recalculatedGame, action, false); // Important: don't re-add to log
    }
    
    // After re-applying all actions, set the gameLog and clock state
    return produce(recalculatedGame, draft => {
        draft.gameLog = log;
        // If a clock state was passed, apply it. Otherwise, the recalculated clock state is used.
        if (clockStateToPreserve) {
            draft.gameClock = clockStateToPreserve.gameClock;
            draft.clockIsRunning = clockStateToPreserve.clockIsRunning;
            draft.isTimeoutActive = clockStateToPreserve.isTimeoutActive;
            draft.timeoutClock = clockStateToPreserve.timeoutClock;
            draft.timeoutCaller = clockStateToPreserve.timeoutCaller;
        }
    });
}

/**
 * Ensures a team does not have more than 5 players on court.
 * This is a safeguard function to be called after any substitution logic.
 * @param team - The team object to sanitize.
 */
const sanitizePlayersOnCourt = (team: TeamInGame) => {
    if (team.playersOnCourt.length > 5) {
        team.playersOnCourt = team.playersOnCourt.slice(0, 5);
    }
};


/**
 * Applies a single action to the current game state to produce the next state.
 * This is used for incremental updates.
 * @param currentState - The current game state.
 * @param action - The action to apply.
 * @param pushToLog - Whether to add this action to the game log. Defaults to true.
 * @returns The new game state.
 */
export function applyActionToGameState(currentState: Game, action: GameAction, pushToLog = true): Game {
    
    return produce(currentState, draft => {
        const { type, payload } = action;
        let team: TeamInGame | null = null;
        if (payload.teamId) {
            team = draft[payload.teamId];
        }


        const recalculateDerivedStats = (teamToUpdate: TeamInGame) => {
            let totalPoints = 0;
            Object.keys(teamToUpdate.playerStats).forEach(playerId => {
                const pStats = teamToUpdate.playerStats[playerId];
                pStats.PTS = (pStats['1PM'] || 0) * 1 + (pStats['2PM'] || 0) * 2 + (pStats['3PM'] || 0) * 3;
                totalPoints += pStats.PTS;
                pStats.REB = (pStats['OREB'] || 0) + (pStats['DREB'] || 0);
            });
            teamToUpdate.stats.score = totalPoints;

            const quarterIndex = draft.currentQuarter - 1;
            if (quarterIndex >= 0) {
                const homeFouls = draft.homeTeam.stats.foulsByQuarter[quarterIndex] || 0;
                draft.homeTeam.stats.inBonus = (draft.awayTeam.stats.foulsByQuarter[quarterIndex] || 0) >= draft.settings.foulsToBonus;
                draft.awayTeam.stats.inBonus = homeFouls >= draft.settings.foulsToBonus;
            }
        };
        
        const newPayloadForLog: GameActionPayload = { ...payload };

        if ((type === 'SCORE_UPDATE' || type === 'STAT_UPDATE') && team && payload.playerId && payload.statType) {
            const playerStats = team.playerStats[payload.playerId];
            if (playerStats && (payload.statType === 'PF' || payload.statType === 'UF' || payload.statType === 'TF')) {
                // We check the *current* stat value plus the incoming one
                const personalFouls = playerStats.PF + playerStats.UF + ((payload.statType === 'PF' || payload.statType === 'UF') ? (payload.manualAdjustment ?? 1) : 0);
                const technicalFouls = playerStats.TF + (payload.statType === 'TF' ? (payload.manualAdjustment ?? 1) : 0);
                
                if (draft.settings.allowFoulOut && personalFouls >= draft.settings.foulsToFoulOut) {
                    newPayloadForLog.isFoulOut = true;
                }
                if (draft.settings.allowTechnicalFoulOut && technicalFouls >= draft.settings.technicalFoulsToFoulOut) {
                    newPayloadForLog.isFoulOut = true;
                }
            }
        }


        if (pushToLog) {
             const createDescription = (p: GameActionPayload): string => {
                const teamData = p.teamId ? currentState[p.teamId] : null;
                const player = teamData && p.playerId ? teamData.players.find(pl => pl.id === p.playerId) : null;
                const playerInName = p.playerInId ? teamData?.players.find(pl => pl.id === p.playerInId)?.name : '';
                const playerOutName = p.playerOutId ? teamData?.players.find(pl => pl.id === p.playerOutId)?.name : '';

                switch (type) {
                    case 'SCORE_UPDATE':
                    case 'STAT_UPDATE':
                        if (player && p.statType) {
                            let baseDesc = `${statDetails[p.statType]?.label || p.statType} de ${player.name} (#${player.number})`;
                             if (p.isFoulOut) {
                                baseDesc += ' (EXPULSADO POR FALTAS)';
                            }
                            return baseDesc;
                        }
                        return `Actualización de estadística`;
                    case 'SUBSTITUTION':
                        return `Sustitución en ${teamData?.name}: Entra ${playerInName}, Sale ${playerOutName}.`;
                    case 'MULTIPLE_SUBSTITUTION':
                        return `Sustitución múltiple en ${teamData?.name} (${p.playersInIds?.length || 0} cambios).`;
                    case 'TIMEOUT':
                        return `Tiempo muerto pedido por ${teamData?.name}.`;
                    case 'QUARTER_CHANGE':
                        return p.newQuarter! > currentState.settings.quarters
                            ? `Inicio de la Prórroga ${p.newQuarter! - currentState.settings.quarters}`
                            : `Inicio del Periodo ${p.newQuarter}`;
                    case 'GAME_END':
                        return 'Final del Partido.';
                     case 'TIMER_CHANGE':
                        if (p.timerState === 'PLAY') return 'Reloj iniciado.';
                        if (p.timerState === 'PAUSE') return 'Reloj pausado.';
                        return 'Acción de juego';
                    case 'TIMER_RESET':
                        return 'Tiempo del periodo reiniciado.';
                    case 'MANUAL_TIMER_ADJUST':
                         return `Reloj ajustado manualmente en ${p.timeAdjustment}s.`;
                    case 'SET_TIMER':
                        const { minutes, seconds } = formatClock(p.newTime || 0);
                        return `Tiempo establecido a ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.`;
                    case 'SET_POSSESSION_ARROW':
                         return `Posesión asignada a ${teamData?.name}.`;
                    default:
                        return 'Acción de juego';
                }
            };
            
            const newAction: GameAction = {
                id: `action_${Date.now()}_${Math.random()}`,
                timestamp: Date.now(),
                type: action.type,
                description: createDescription(newPayloadForLog),
                payload: { 
                    ...newPayloadForLog,
                    quarter: currentState.currentQuarter,
                    gameClock: currentState.gameClock,
                    homeScore: currentState.homeTeam.stats.score,
                    awayScore: currentState.awayTeam.stats.score,
                 },
            };
            
            draft.gameLog.push(newAction);
        }

        switch (type) {
            case 'SCORE_UPDATE':
            case 'STAT_UPDATE': {
                if (!team || !payload.playerId) return;
                const playerStats = team.playerStats[payload.playerId];
                if (!playerStats) return;

                const { statType, manualAdjustment, pointsScored } = payload;
                const adjustment = manualAdjustment ?? 1;

                if (manualAdjustment) {
                    playerStats[statType as StatType] = Math.max(0, playerStats[statType as StatType] + adjustment);
                    if (statType === '1PM') playerStats['1PA'] = Math.max(playerStats['1PM'], playerStats['1PA'] + adjustment);
                    if (statType === '2PM') playerStats['2PA'] = Math.max(playerStats['2PM'], playerStats['2PA'] + adjustment);
                    if (statType === '3PM') playerStats['3PA'] = Math.max(playerStats['3PM'], playerStats['3PA'] + adjustment);
                } else {
                    if (pointsScored) {
                        const madeStat = `${pointsScored}PM` as '1PM' | '2PM' | '3PM';
                        const attemptStat = `${pointsScored}PA` as '1PA' | '2PA' | '3PA';
                        playerStats[madeStat]++;
                        playerStats[attemptStat]++;
                    } else {
                        playerStats[statType as StatType]++;
                    }
                }

                if (statType === 'PF' || statType === 'UF' || statType === 'TF') {
                    const quarterIndex = draft.currentQuarter - 1;
                    if (quarterIndex >= 0 && quarterIndex < team.stats.foulsByQuarter.length) {
                        team.stats.foulsByQuarter[quarterIndex] = Math.max(0, team.stats.foulsByQuarter[quarterIndex] + adjustment);
                    }
                     if (newPayloadForLog.isFoulOut && !team.fouledOutPlayers.includes(payload.playerId)) {
                        team.fouledOutPlayers.push(payload.playerId);
                        // The player remains on the court visually until substituted by the user.
                    }
                }

                recalculateDerivedStats(team);
                break;
            }
            case 'QUARTER_CHANGE': {
                const oldQuarter = draft.currentQuarter;
                const newQuarter = payload.newQuarter!;
                draft.currentQuarter = newQuarter;
                draft.gameClock = newQuarter > draft.settings.quarters ? draft.settings.overtimeLength : draft.settings.quarterLength;
                draft.clockIsRunning = false;

                 // Reset timeouts based on the game rules
                const { timeoutSettings } = draft.settings;
                if (newQuarter > oldQuarter) { // Only apply on advancing quarter
                    if (timeoutSettings.mode === 'per_quarter') {
                        draft.homeTeam.stats.timeouts = timeoutSettings.timeoutsPerQuarter;
                        draft.awayTeam.stats.timeouts = timeoutSettings.timeoutsPerQuarter;
                    } else if (timeoutSettings.mode === 'per_quarter_custom') {
                        const quarterIndex = newQuarter - 1;
                        const timeoutsForQuarter = timeoutSettings.timeoutsPerQuarterValues[quarterIndex] ?? 0;
                        draft.homeTeam.stats.timeouts = timeoutsForQuarter;
                        draft.awayTeam.stats.timeouts = timeoutsForQuarter;
                    } else if (timeoutSettings.mode === 'per_half' && oldQuarter === Math.floor(draft.settings.quarters / 2) && newQuarter > Math.floor(draft.settings.quarters / 2)) {
                        // When moving into the second half
                        draft.homeTeam.stats.timeouts = timeoutSettings.timeoutsSecondHalf;
                        draft.awayTeam.stats.timeouts = timeoutSettings.timeoutsSecondHalf;
                    }
                    
                    if (newQuarter > draft.settings.quarters) { // Entering overtime
                        draft.homeTeam.stats.timeouts += draft.settings.timeoutsOvertime;
                        draft.awayTeam.stats.timeouts += draft.settings.timeoutsOvertime;
                    }
                }


                draft.homeTeam.stats.inBonus = false;
                draft.awayTeam.stats.inBonus = false;
                break;
            }
            case 'TIMEOUT': {
                if (draft.isTimeoutActive) {
                    draft.isTimeoutActive = false;
                    draft.timeoutCaller = undefined;
                    draft.clockIsRunning = false;
                    return;
                }

                if (team && team.stats.timeouts > 0) {
                    team.stats.timeouts--;
                    draft.clockIsRunning = false;
                    draft.isTimeoutActive = true;
                    draft.timeoutClock = draft.settings.timeoutLength;
                    draft.timeoutCaller = team.id as 'homeTeam' | 'awayTeam';
                }
                break;
            }
            case 'SUBSTITUTION': {
                if (!team || !payload.playerInId || !payload.playerOutId) return;
                const { playerInId, playerOutId } = payload;
                const onCourtIndex = team.playersOnCourt.indexOf(playerOutId);
                if (onCourtIndex !== -1) {
                    team.playersOnCourt.splice(onCourtIndex, 1, playerInId);
                }
                sanitizePlayersOnCourt(team); // Safeguard
                break;
            }
             case 'MULTIPLE_SUBSTITUTION': {
                if (!team || !payload.playersInIds || !payload.playersOutIds) return;
                const { playersInIds, playersOutIds } = payload;
                
                // More robust substitution logic
                let playersRemovedCount = 0;
                const currentOnCourt = [...team.playersOnCourt];
                const newOnCourt = currentOnCourt.filter(id => {
                    const shouldRemove = playersOutIds.includes(id);
                    if (shouldRemove) {
                        playersRemovedCount++;
                    }
                    return !shouldRemove;
                });
                
                // Only add the same number of players that were successfully removed
                const playersToAdd = playersInIds.slice(0, playersRemovedCount);
                newOnCourt.push(...playersToAdd);

                team.playersOnCourt = newOnCourt;
                sanitizePlayersOnCourt(team); // Safeguard
                break;
            }
            case 'ADD_PLAYER_TO_COURT': {
                if (!team || !payload.playerInId) return;
                const { playerInId } = payload;
                // Add strict check for 5 players
                if (team.playersOnCourt.length < 5 && !team.playersOnCourt.includes(playerInId)) {
                    team.playersOnCourt.push(playerInId);
                }
                break;
            }
            case 'SET_POSSESSION_ARROW': {
                if (!payload.teamId) return;
                draft.possessionArrowHolder = payload.teamId;
                break;
            }
            case 'MANUAL_TIMER_ADJUST':
                draft.gameClock = Math.max(0, draft.gameClock + payload.timeAdjustment!);
                draft.clockIsRunning = false;
                break;
            case 'SET_TIMER':
                draft.gameClock = payload.newTime!;
                draft.clockIsRunning = false;
                break;
            case 'TIMER_CHANGE':
                if (payload.timerState === 'PLAY') draft.clockIsRunning = true;
                if (payload.timerState === 'PAUSE') draft.clockIsRunning = false;
                break;
            case 'TIMER_RESET': {
                const isOvertime = draft.currentQuarter > draft.settings.quarters;
                draft.gameClock = isOvertime 
                    ? draft.settings.overtimeLength
                    : draft.settings.quarterLength;
                draft.clockIsRunning = false;
                break;
            }
            case 'TICK':
                if (draft.isTimeoutActive) {
                    draft.timeoutClock = Math.max(0, draft.timeoutClock - 1);
                    if (draft.timeoutClock === 0) {
                        draft.isTimeoutActive = false;
                        draft.timeoutCaller = undefined;
                    }
                } else if (draft.clockIsRunning) {
                    draft.gameClock = Math.max(0, draft.gameClock - 1);
                    if (draft.gameClock === 0) {
                        draft.clockIsRunning = false;
                    }
                }
                break;
            case 'GAME_END': {
                draft.status = 'FINISHED';
                draft.clockIsRunning = false;
                break;
            }
        }
    });
}

function formatClock(clock: number) {
    const minutes = Math.floor(clock / 60);
    const seconds = clock % 60;
    return { minutes, seconds };
};
    
export const calculateEfficiency = (stats: PlayerStats): number => {
    if (!stats) return 0;
    const fgMissed = (stats['2PA'] + stats['3PA']) - (stats['2PM'] + stats['3PM']);
    const ftMissed = stats['1PA'] - stats['1PM'];
    const totalFouls = stats.PF + stats.UF + stats.TF;
    return (stats.PTS + stats.REB + stats.AST + stats.STL + stats.BLK) - (fgMissed + ftMissed + stats.TOV + totalFouls);
};



import type { Game, Player, TeamInGame, PlayerStats, GameAction, StatType } from '@/lib/types';
import { produce } from 'immer';
import { defaultAppSettings } from './types';

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
        foulsByQuarter: Array(quarters + 10).fill(0),
        inBonus: false,
    },
    playerStats: players.reduce((acc, player) => {
        acc[player.id] = createInitialPlayerStats();
        return acc;
    }, {} as Record<string, PlayerStats>),
    playersOnCourt: players.slice(0, 5).map(p => p.id),
});

/**
 * creates the entire initial state for a new game.
 * @returns a new Game object.
 */
export function createInitialGame(): Game {
    const settings = defaultAppSettings.gameSettings;

    return {
        id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: Date.now(),
        homeTeam: createTeamInGame('homeTeam', 'Local', [], settings.quarters),
        awayTeam: createTeamInGame('awayTeam', 'Visitante', [], settings.quarters),
        gameLog: [],
        status: 'SETUP',
        currentQuarter: 1,
        gameClock: settings.quarterLength,
        clockIsRunning: false,
        isTimeoutActive: false,
        timeoutClock: settings.timeoutLength,
        settings
    };
}


/**
 * Recalculates the entire game state from the game log.
 * This is a pure function. Given the same initial state and log, it will always produce the same result.
 * @param baseGame - The CURRENT game state, used for settings, rosters, and live clock state.
 * @param log - The array of GameAction events to process.
 * @returns A new Game object representing the calculated state.
 */
export function recalculateGameStateFromLog(baseGame: Game, log: GameAction[]): Game {
    return produce(baseGame, draft => {
        // 1. reset all calculable stats to a clean slate, keeping rosters and settings.
        const { settings } = draft;
        const { timeoutSettings } = settings;

        const getInitialTimeouts = () => {
            switch (timeoutSettings.mode) {
                case 'per_quarter': return timeoutSettings.timeoutsPerQuarter;
                case 'per_half': return timeoutSettings.timeoutsFirstHalf;
                case 'total': return timeoutSettings.timeoutsTotal;
                default: return 2;
            }
        };
        
        draft.homeTeam.stats = { score: 0, timeouts: getInitialTimeouts(), foulsByQuarter: Array(settings.quarters + 10).fill(0), inBonus: false };
        draft.awayTeam.stats = { score: 0, timeouts: getInitialTimeouts(), foulsByQuarter: Array(settings.quarters + 10).fill(0), inBonus: false };
        
        Object.keys(draft.homeTeam.playerStats).forEach(playerId => {
            draft.homeTeam.playerStats[playerId] = createInitialPlayerStats();
        });
        Object.keys(draft.awayTeam.playerStats).forEach(playerId => {
            draft.awayTeam.playerStats[playerId] = createInitialPlayerStats();
        });
        
        draft.homeTeam.playersOnCourt = baseGame.homeTeam.players.slice(0,5).map(p => p.id);
        draft.awayTeam.playersOnCourt = baseGame.awayTeam.players.slice(0,5).map(p => p.id);

        draft.gameLog = log;
        draft.currentQuarter = 1;
        draft.gameClock = settings.quarterLength;
        
        // Process each action in the log sequentially to rebuild the state.
        for (const action of draft.gameLog) {
            const { type, payload } = action;
            const team = payload.teamId ? draft[payload.teamId] : null;

            switch (type) {
                case 'SCORE_UPDATE':
                case 'STAT_UPDATE': {
                    if (!team || !payload.playerId) continue;
                    const playerStats = team.playerStats[payload.playerId];
                    if (!playerStats) continue;

                    const { statType, manualAdjustment, pointsScored } = payload;

                    if (manualAdjustment) { // From detailed modal
                        playerStats[statType as StatType] = Math.max(0, playerStats[statType as StatType] + manualAdjustment);
                        if (statType === '1PM' && manualAdjustment > 0) playerStats['1PA']++;
                        if (statType === '2PM' && manualAdjustment > 0) playerStats['2PA']++;
                        if (statType === '3PM' && manualAdjustment > 0) playerStats['3PA']++;
                    } else { // From shortcut buttons
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
                           team.stats.foulsByQuarter[quarterIndex]++;
                        }
                    }
                    break;
                }
                case 'QUARTER_CHANGE': {
                    const oldQuarter = draft.currentQuarter;
                    const newQuarter = payload.newQuarter!;
                    draft.currentQuarter = newQuarter;
                    draft.gameClock = newQuarter > settings.quarters ? settings.overtimeLength : settings.quarterLength;

                    // Grant timeouts based on mode
                    if (newQuarter > oldQuarter) {
                         if (timeoutSettings.mode === 'per_quarter') {
                            draft.homeTeam.stats.timeouts = timeoutSettings.timeoutsPerQuarter;
                            draft.awayTeam.stats.timeouts = timeoutSettings.timeoutsPerQuarter;
                        }
                        else if (timeoutSettings.mode === 'per_half' && oldQuarter <= settings.quarters / 2 && newQuarter > settings.quarters / 2) {
                            draft.homeTeam.stats.timeouts = timeoutSettings.timeoutsSecondHalf;
                            draft.awayTeam.stats.timeouts = timeoutSettings.timeoutsSecondHalf;
                        }

                        // Overtime timeouts are always added
                        if (newQuarter > settings.quarters) {
                            draft.homeTeam.stats.timeouts += settings.timeoutsOvertime;
                            draft.awayTeam.stats.timeouts += settings.timeoutsOvertime;
                        }
                    }
                    
                    // Reset bonus for the new quarter
                    draft.homeTeam.stats.inBonus = false;
                    draft.awayTeam.stats.inBonus = false;
                    break;
                }
                 case 'TIMEOUT': {
                    if (team && team.stats.timeouts > 0) {
                        team.stats.timeouts--;
                    }
                    break;
                }
                 case 'SUBSTITUTION': {
                    if (!team || !payload.playerInId || !payload.playerOutId) continue;
                    const { playerInId, playerOutId } = payload;
                    const onCourtIndex = team.playersOnCourt.indexOf(playerOutId);

                    if (onCourtIndex !== -1) {
                        team.playersOnCourt.splice(onCourtIndex, 1, playerInId);
                    }
                    break;
                }
                case 'ADD_PLAYER_TO_COURT': {
                    if (!team || !payload.playerInId) continue;
                    const { playerInId } = payload;
                    if (team.playersOnCourt.length < 5 && !team.playersOnCourt.includes(playerInId)) {
                        team.playersOnCourt.push(playerInId);
                    }
                    break;
                }
                case 'MANUAL_TIMER_ADJUST':
                     draft.gameClock = Math.max(0, draft.gameClock + payload.timeAdjustment!);
                     break;
                case 'SET_TIMER':
                     draft.gameClock = payload.newTime!;
                     break;
            }

            // After each action, recalculate derived stats for both teams
            for (const teamId of ['homeTeam', 'awayTeam'] as const) {
                const currentTeam = draft[teamId];
                let totalPoints = 0;
                
                Object.keys(currentTeam.playerStats).forEach(playerId => {
                    const pStats = currentTeam.playerStats[playerId];
                    pStats.PTS = (pStats['1PM'] || 0) * 1 + (pStats['2PM'] || 0) * 2 + (pStats['3PM'] || 0) * 3;
                    totalPoints += pStats.PTS;
                    
                    pStats.REB = (pStats['OREB'] || 0) + (pStats['DREB'] || 0);
                });
                
                currentTeam.stats.score = totalPoints;
            }

            // Recalculate bonus status based on fouls for the current quarter
            const quarterIndex = draft.currentQuarter - 1;
            if (quarterIndex >= 0) {
                const homeFouls = draft.homeTeam.stats.foulsByQuarter[quarterIndex] || 0;
                draft.awayTeam.stats.inBonus = homeFouls >= settings.foulsToBonus;

                const awayFouls = draft.awayTeam.stats.foulsByQuarter[quarterIndex] || 0;
                draft.homeTeam.stats.inBonus = awayFouls >= settings.foulsToBonus;
            }
        }
    });
}

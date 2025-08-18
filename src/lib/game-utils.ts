

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
 * It's useful for undoing actions or loading a game from storage.
 * @param baseGame - The initial state of the game (rosters, settings).
 * @param log - The array of GameAction events to process.
 * @returns A new Game object representing the calculated state.
 */
export function recalculateGameStateFromLog(baseGame: Game, log: GameAction[]): Game {
    
    // Create a fresh slate based on the base game's settings and rosters
    let cleanState = produce(createInitialGame(), draft => {
        draft.id = baseGame.id;
        draft.date = baseGame.date;
        draft.settings = baseGame.settings;
        draft.homeTeam.players = baseGame.homeTeam.players;
        draft.awayTeam.players = baseGame.awayTeam.players;
        draft.homeTeam.name = baseGame.homeTeam.name;
        draft.awayTeam.name = baseGame.awayTeam.name;

        // Initialize player stats maps for all players in the roster
        draft.homeTeam.playerStats = baseGame.homeTeam.players.reduce((acc, p) => {
            acc[p.id] = createInitialPlayerStats();
            return acc;
        }, {} as Record<string, PlayerStats>);

        draft.awayTeam.playerStats = baseGame.awayTeam.players.reduce((acc, p) => {
            acc[p.id] = createInitialPlayerStats();
            return acc;
        }, {} as Record<string, PlayerStats>);

        // Keep the live state from the base game
        draft.clockIsRunning = baseGame.clockIsRunning;
        draft.isTimeoutActive = baseGame.isTimeoutActive;
        draft.timeoutClock = baseGame.timeoutClock;
        draft.timeoutCaller = baseGame.timeoutCaller;
        draft.homeTeam.playersOnCourt = baseGame.homeTeam.playersOnCourt;
        draft.awayTeam.playersOnCourt = baseGame.awayTeam.playersOnCourt;
    });

    // Apply every action from the log to the clean slate
    let finalState = cleanState;
    for (const action of log) {
        finalState = applyActionToGameState(finalState, action, false); // Don't push to log again
    }

    // After replaying the log, restore the clock time from the last relevant action
    const lastTimeAction = [...log].reverse().find(a => a.type !== 'UNDO_LAST_ACTION' && a.payload.gameClock !== undefined);
    if(lastTimeAction) {
        finalState.gameClock = lastTimeAction.payload.gameClock;
    }
    
    return finalState;
}

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
        if (pushToLog) {
            draft.gameLog.push(action);
        }

        const { type, payload } = action;
        const team = payload.teamId ? draft[payload.teamId] : null;

        const recalculateDerivedStats = (teamToUpdate: TeamInGame) => {
            let totalPoints = 0;
            Object.keys(teamToUpdate.playerStats).forEach(playerId => {
                const pStats = teamToUpdate.playerStats[playerId];
                pStats.PTS = (pStats['1PM'] || 0) * 1 + (pStats['2PM'] || 0) * 2 + (pStats['3PM'] || 0) * 3;
                totalPoints += pStats.PTS;
                pStats.REB = (pStats['OREB'] || 0) + (pStats['DREB'] || 0);
            });
            teamToUpdate.stats.score = totalPoints;

            // Recalculate bonus
            const quarterIndex = draft.currentQuarter - 1;
            if (quarterIndex >= 0) {
                const homeFouls = draft.homeTeam.stats.foulsByQuarter[quarterIndex] || 0;
                draft.awayTeam.stats.inBonus = homeFouls >= draft.settings.foulsToBonus;

                const awayFouls = draft.awayTeam.stats.foulsByQuarter[quarterIndex] || 0;
                draft.homeTeam.stats.inBonus = awayFouls >= draft.settings.foulsToBonus;
            }
        };

        switch (type) {
            case 'SCORE_UPDATE':
            case 'STAT_UPDATE': {
                if (!team || !payload.playerId) return;
                const playerStats = team.playerStats[payload.playerId];
                if (!playerStats) return;

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
                
                recalculateDerivedStats(team);
                break;
            }
            case 'QUARTER_CHANGE': {
                const oldQuarter = draft.currentQuarter;
                const newQuarter = payload.newQuarter!;
                draft.currentQuarter = newQuarter;
                draft.gameClock = newQuarter > draft.settings.quarters ? draft.settings.overtimeLength : draft.settings.quarterLength;
                draft.clockIsRunning = false;

                if (newQuarter > oldQuarter) {
                    const { timeoutSettings } = draft.settings;
                    if (timeoutSettings.mode === 'per_quarter') {
                        draft.homeTeam.stats.timeouts = timeoutSettings.timeoutsPerQuarter;
                        draft.awayTeam.stats.timeouts = timeoutSettings.timeoutsPerQuarter;
                    } else if (timeoutSettings.mode === 'per_half' && oldQuarter <= draft.settings.quarters / 2 && newQuarter > draft.settings.quarters / 2) {
                        draft.homeTeam.stats.timeouts = timeoutSettings.timeoutsSecondHalf;
                        draft.awayTeam.stats.timeouts = timeoutSettings.timeoutsSecondHalf;
                    }

                    if (newQuarter > draft.settings.quarters) {
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
                    draft.clockIsRunning = true; // or based on user preference
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
                break;
            }
            case 'ADD_PLAYER_TO_COURT': {
                if (!team || !payload.playerInId) return;
                const { playerInId } = payload;
                if (team.playersOnCourt.length < 5 && !team.playersOnCourt.includes(playerInId)) {
                    team.playersOnCourt.push(playerInId);
                }
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
        }
    });
}

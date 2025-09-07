

export interface Player {
  id: string;
  name: string;
  number?: number;
  position?: string;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export const STAT_TYPES = [
  '1PM', '1PA', '2PM', '2PA', '3PM', '3PA', 
  'DREB', 'OREB', 'AST', 'STL', 'BLK', 'TOV', 'PF', 'UF', 'TF'
] as const;

export type StatType = (typeof STAT_TYPES)[number] | 'REB';

export type PlayerStats = {
  [key in (typeof STAT_TYPES)[number]]: number;
} & { PTS: number; REB: number };


export interface TeamInGame {
  id: string;
  name: string;
  players: Player[];
  stats: TeamGameStats;
  playerStats: Record<string, PlayerStats>;
  playersOnCourt: string[];
  fouledOutPlayers: string[];
}

export interface TeamGameStats {
  score: number;
  timeouts: number;
  foulsByQuarter: number[];
  inBonus: boolean;
}

export type ActionType =
  | 'STAT_UPDATE'
  | 'SCORE_UPDATE'
  | 'SUBSTITUTION'
  | 'MULTIPLE_SUBSTITUTION'
  | 'TIMEOUT'
  | 'TIMER_CHANGE'
  | 'TIMER_RESET'
  | 'MANUAL_TIMER_ADJUST'
  | 'SET_TIMER'
  | 'QUARTER_CHANGE'
  | 'GAME_START'
  | 'GAME_END'
  | 'REOPEN_GAME'
  | 'UNDO_LAST_ACTION'
  | 'TICK'
  | 'ADD_PLAYER_TO_COURT'
  | 'SET_POSSESSION_ARROW';

export interface GameActionPayload {
  // For most actions, these are present
  quarter?: number;
  gameClock?: number;
  homeScore?: number;
  awayScore?: number;
  teamId?: 'homeTeam' | 'awayTeam';
  playerId?: string;
  statType?: StatType;
  isFoulOut?: boolean; // Added to flag a foul out action
  pointsScored?: number;
  manualAdjustment?: 1 | -1;
  playerInId?: string;
  playerOutId?: string;
  playersInIds?: string[]; // For multiple substitutions
  playersOutIds?: string[]; // For multiple substitutions
  timerState?: 'PLAY' | 'PAUSE';
  timeAdjustment?: number;
  newTime?: number;
  newQuarter?: number;
  // For GAME_START and REOPEN_GAME, the payload can be the full game object
  gameData?: Game;
}


export interface GameAction {
  id: string;
  timestamp: number;
  type: ActionType;
  description: string;
  payload: GameActionPayload;
}


export type TimeoutMode = 'per_quarter' | 'per_half' | 'total' | 'per_quarter_custom';

export interface GameSettings {
  name: string;
  quarters: number;
  quarterLength: number; // in seconds on the game object, in minutes in the UI
  overtimeLength: number; // in seconds on the game object, in minutes in the UI
  timeoutLength: number;
  allowFoulOut: boolean;
  foulsToFoulOut: number;
  allowTechnicalFoulOut: boolean;
  technicalFoulsToFoulOut: number;
  
  timeoutSettings: {
    mode: TimeoutMode;
    timeoutsPerQuarter: number;
    timeoutsPerQuarterValues: number[];
    timeoutsFirstHalf: number;
    timeoutsSecondHalf: number;
    timeoutsTotal: number;
  };
  
  timeoutsOvertime: number;
  foulsToBonus: number;
}

export interface AppSettings {
  gameSettings: GameSettings;
}

export const defaultAppSettings: AppSettings = {
    gameSettings: {
        name: '',
        quarters: 4,
        quarterLength: 10,
        overtimeLength: 5,
        timeoutLength: 60,
        allowFoulOut: true,
        foulsToFoulOut: 5,
        allowTechnicalFoulOut: true,
        technicalFoulsToFoulOut: 2,
        timeoutSettings: {
            mode: 'per_half',
            timeoutsPerQuarter: 1,
            timeoutsPerQuarterValues: [1, 1, 1, 1],
            timeoutsFirstHalf: 2,
            timeoutsSecondHalf: 3,
            timeoutsTotal: 5,
        },
        timeoutsOvertime: 1,
        foulsToBonus: 5,
    },
};


export interface Game {
  id: string;
  date: number;
  homeTeam: TeamInGame;
  awayTeam: TeamInGame;
  gameLog: GameAction[];
  settings: GameSettings;
  status: 'SETUP' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';
  currentQuarter: number;
  gameClock: number; // in seconds
  clockIsRunning: boolean;
  isTimeoutActive: boolean;
  timeoutClock: number; // in seconds
  timeoutCaller?: 'homeTeam' | 'awayTeam';
  possessionArrowHolder?: 'homeTeam' | 'awayTeam' | null;
  // Optional tournament link
  tournamentId?: string;
  matchId?: string;
  // For handling resumed game stats correctly
  previousScores?: { home: number; away: number };
}

// Live Game specific types
export type SubstitutionState = {
  teamId: 'homeTeam' | 'awayTeam';
  playerInId?: string;
  playerOutId?: string;
  mode: 'in' | 'out';
} | null;

export type FollowUpActionState = {
    type: 'assist' | 'steal' | 'block';
    primaryAction: GameAction;
    teamId: 'homeTeam' | 'awayTeam';
    playerId: string;
} | null;


// Tournament specific types
export interface TournamentPlayer extends Player {}

export interface TournamentTeam {
  id: string; // original team id from main roster
  name: string;
  players: TournamentPlayer[];
  // Tournament specific stats
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TournamentMatch {
    id: string;
    team1: { id: string, score?: number };
    team2: { id: string, score?: number };
    status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED';
    gameId?: string; // Link to the actual game in gameHistory
    stage: 'regular-season' | 'final';
}

export type TournamentFormat = 'round-robin';
export type PlayoffFormat = 'best-of-3' | 'single-game';

export interface Tournament {
  id: string;
  name: string;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  gameSettings: GameSettings;
  format: TournamentFormat;
  rounds: number;
  playoffSettings: {
    enabled: boolean;
    finalFormat?: PlayoffFormat;
  };
}


// Stats Page Specific
export interface AggregatedPlayerStats extends Player {
    teamId: string;
    teamName: string;
    gamesPlayed: number;
    totals: PlayerStats;
    averages: { [key in keyof Omit<PlayerStats, 'PTS' | 'DREB' | 'OREB' | 'REB'>]: number } & { PPG: number, RPG: number, DREB: number, OREB: number, APG: number, SPG: number, BPG: number };
    efficiency: number;
}



import type { Game, TeamInGame, PlayerStats, AggregatedPlayerStats } from './types';

function downloadFile(content: string, filename: string, contentType: string) {
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function exportGameToJson(game: Game) {
    const gameJson = JSON.stringify(game, null, 2);
    const homeTeamName = game.homeTeam.name.replace(/\s/g, '_');
    const awayTeamName = game.awayTeam.name.replace(/\s/g, '_');
    const filename = `partido_${homeTeamName}_vs_${awayTeamName}_${game.id}.json`;
    downloadFile(gameJson, filename, 'application/json');
}

export function exportPlayByPlayToCsv(game: Game) {
    if (!game.gameLog || game.gameLog.length === 0) return;

    const headers = [
        "id", "timestamp", "type", "description", "quarter", "gameClock", 
        "homeScore", "awayScore", "teamId", "playerId", "statType", 
        "pointsScored", "playerInId", "playerOutId", "timerState"
    ];

    const csvRows = [headers.join(',')];

    for (const action of game.gameLog) {
        const { payload } = action;
        const row = [
            action.id,
            action.timestamp,
            action.type,
            `"${action.description.replace(/"/g, '""')}"`,
            payload.quarter ?? '',
            payload.gameClock ?? '',
            payload.homeScore ?? '',
            payload.awayScore ?? '',
            payload.teamId ?? '',
            payload.playerId ?? '',
            payload.statType ?? '',
            payload.pointsScored ?? 0,
            payload.playerInId ?? '',
            payload.playerOutId ?? '',
            payload.timerState ?? ''
        ];
        csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = `play_by_play_${game.id}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}


const BOX_SCORE_HEADERS = [
    "Jugador", "Numero", "Posicion", "PTS", "REB", "AST", "ROB", "TAP", 
    "2P-INT", "2P-ANO", "3P-INT", "3P-ANO", "TL-INT", "TL-ANO", "FP", "FA", "FT",
    "REB-OF", "REB-DEF", "PERDIDAS"
];

function getPlayerBoxScoreRow(player: any, stats: PlayerStats): string[] {
    return [
        player.name,
        player.number ?? '-',
        player.position ?? '-',
        stats.PTS,
        stats.REB,
        stats.AST,
        stats.STL,
        stats.BLK,
        stats['2PA'],
        stats['2PM'],
        stats['3PA'],
        stats['3PM'],
        stats['1PA'],
        stats['1PM'],
        stats.PF,
        stats.UF,
        stats.TF,
        stats.OREB,
        stats.DREB,
        stats.TOV
    ].map(String);
}

function getTeamTotalsRow(team: TeamInGame): string[] {
    const totals = Object.values(team.playerStats).reduce((acc, stats) => {
        Object.keys(stats).forEach(key => {
            const statKey = key as keyof PlayerStats;
            acc[statKey] = (acc[statKey] || 0) + stats[statKey];
        });
        return acc;
    }, {} as PlayerStats);

    return [
        `TOTAL ${team.name}`, '', '',
        totals.PTS, totals.REB, totals.AST, totals.STL, totals.BLK,
        totals['2PA'], totals['2PM'], totals['3PA'], totals['3PM'],
        totals['1PA'], totals['1PM'], totals.PF, totals.UF, totals.TF,
        totals.OREB, totals.DREB, totals.TOV
    ].map(String);
}


export function exportBoxScoreToCsv(game: Game) {
    const csvRows = [
        `Box Score - ${game.homeTeam.name} vs ${game.awayTeam.name}`,
        `Fecha: ${new Date(game.date).toLocaleString()}`,
        `Resultado Final: ${game.homeTeam.stats.score} - ${game.awayTeam.stats.score}`,
        '', // Empty line for spacing
        // Home Team
        `Equipo: ${game.homeTeam.name}`,
        BOX_SCORE_HEADERS.join(','),
        ...game.homeTeam.players.map(p => getPlayerBoxScoreRow(p, game.homeTeam.playerStats[p.id]).join(',')),
        getTeamTotalsRow(game.homeTeam).join(','),
        '', // Empty line for spacing
        // Away Team
        `Equipo: ${game.awayTeam.name}`,
        BOX_SCORE_HEADERS.join(','),
        ...game.awayTeam.players.map(p => getPlayerBoxScoreRow(p, game.awayTeam.playerStats[p.id]).join(',')),
        getTeamTotalsRow(game.awayTeam).join(','),
    ];
    
    const csvContent = csvRows.join('\n');
    const homeTeamName = game.homeTeam.name.replace(/\s/g, '_');
    const awayTeamName = game.awayTeam.name.replace(/\s/g, '_');
    const filename = `box_score_${homeTeamName}_vs_${awayTeamName}_${game.id}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}


export function exportTournamentLeadersToCsv(players: AggregatedPlayerStats[]) {
    if (players.length === 0) return;

    const headers = [
        "ID Jugador", "Nombre", "Numero", "Equipo", "Posicion", "PJ",
        "EFF", "PPG", "RPG", "APG", "SPG", "BPG",
        "Total PTS", "Total REB", "Total AST", "Total ROB", "Total TAP",
        "Total 2P-INT", "Total 2P-ANO", "Total 3P-INT", "Total 3P-ANO",
        "Total TL-INT", "Total TL-ANO", "Total FP", "Total FA", "Total FT",
        "Total REB-OF", "Total REB-DEF", "Total PERDIDAS"
    ];

    const csvRows: string[] = [headers.join(',')];

    for (const player of players) {
        const row = [
            player.id,
            player.name,
            player.number ?? '',
            player.teamName,
            player.position ?? '',
            player.gamesPlayed,
            player.efficiency,
            player.averages.PPG,
            player.averages.RPG,
            player.averages.APG,
            player.averages.SPG,
            player.averages.BPG,
            player.totals.PTS,
            player.totals.REB,
            player.totals.AST,
            player.totals.STL,
            player.totals.BLK,
            player.totals['2PA'],
            player.totals['2PM'],
            player.totals['3PA'],
            player.totals['3PM'],
            player.totals['1PA'],
            player.totals['1PM'],
            player.totals.PF,
            player.totals.UF,
            player.totals.TF,
            player.totals.OREB,
            player.totals.DREB,
            player.totals.TOV
        ].map(value => `"${String(value).replace(/"/g, '""')}"`);
        
        csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = `lideres_torneo_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

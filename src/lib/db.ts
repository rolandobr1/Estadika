
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import type { Player, Team, Tournament, Game } from '@/lib/types';

// Collection Names
const PLAYERS_COLLECTION = 'players';
const TEAMS_COLLECTION = 'teams';
const TOURNAMENTS_COLLECTION = 'tournaments';
const GAMES_COLLECTION = 'games'; // For finished games history
const LIVE_GAME_COLLECTION = 'live-game'; // For the single live game

// --- Player Functions ---

export async function getPlayers(): Promise<Player[]> {
    const playersCol = collection(db, PLAYERS_COLLECTION);
    const playerSnapshot = await getDocs(playersCol);
    const playerList = playerSnapshot.docs.map(doc => doc.data() as Player);
    return playerList;
}

export async function savePlayer(player: Player): Promise<void> {
    const playerRef = doc(db, PLAYERS_COLLECTION, player.id);
    await setDoc(playerRef, player, { merge: true });
}

export async function deletePlayers(playerIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    playerIds.forEach(id => {
        const playerRef = doc(db, PLAYERS_COLLECTION, id);
        batch.delete(playerRef);
    });

    // Also remove player from any teams they are in
    const teams = await getTeams();
    teams.forEach(team => {
        const newPlayerIds = team.playerIds.filter(pid => !playerIds.includes(pid));
        if (newPlayerIds.length !== team.playerIds.length) {
            const teamRef = doc(db, TEAMS_COLLECTION, team.id);
            batch.update(teamRef, { playerIds: newPlayerIds });
        }
    });

    await batch.commit();
}

export async function importPlayers(players: Player[]): Promise<number> {
    const batch = writeBatch(db);
    const playersCol = collection(db, PLAYERS_COLLECTION);
    
    const playerRefs = players.map(p => doc(playersCol, p.id));
    const playerDocs = await Promise.all(playerRefs.map(ref => getDoc(ref)));

    let newItemsCount = 0;
    playerDocs.forEach((docSnapshot, index) => {
        if (!docSnapshot.exists()) {
            batch.set(docSnapshot.ref, players[index]);
            newItemsCount++;
        }
    });

    await batch.commit();
    return newItemsCount;
}

// --- Team Functions ---

export async function getTeams(): Promise<Team[]> {
    const teamsCol = collection(db, TEAMS_COLLECTION);
    const teamSnapshot = await getDocs(teamsCol);
    const teamList = teamSnapshot.docs.map(doc => doc.data() as Team);
    return teamList;
}

export async function saveTeam(team: Team): Promise<void> {
    const teamRef = doc(db, TEAMS_COLLECTION, team.id);
    await setDoc(teamRef, team, { merge: true });
}

export async function deleteTeams(teamIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    teamIds.forEach(id => {
        const teamRef = doc(db, TEAMS_COLLECTION, id);
        batch.delete(teamRef);
    });
    await batch.commit();
}

export async function importTeams(teams: Team[]): Promise<number> {
    const batch = writeBatch(db);
    const teamsCol = collection(db, TEAMS_COLLECTION);

    const teamRefs = teams.map(t => doc(teamsCol, t.id));
    const teamDocs = await Promise.all(teamRefs.map(ref => getDoc(ref)));

    let newItemsCount = 0;
    teamDocs.forEach((docSnapshot, index) => {
        if (!docSnapshot.exists()) {
            batch.set(docSnapshot.ref, teams[index]);
            newItemsCount++;
        }
    });

    await batch.commit();
    return newItemsCount;
}

// --- Tournament Functions ---

export async function getTournaments(): Promise<Tournament[]> {
    const tournamentsCol = collection(db, TOURNAMENTS_COLLECTION);
    const tournamentSnapshot = await getDocs(tournamentsCol);
    const tournamentList = tournamentSnapshot.docs.map(doc => doc.data() as Tournament);
    return tournamentList;
}

export async function getTournamentById(id: string): Promise<Tournament | null> {
    const tournamentRef = doc(db, TOURNAMENTS_COLLECTION, id);
    const docSnap = await getDoc(tournamentRef);
    return docSnap.exists() ? (docSnap.data() as Tournament) : null;
}

export async function saveTournament(tournament: Tournament): Promise<void> {
    const tournamentRef = doc(db, TOURNAMENTS_COLLECTION, tournament.id);
    await setDoc(tournamentRef, tournament, { merge: true });
}

// --- Game Functions ---

/**
 * Saves a single live game document.
 * The ID is fixed to 'current' to ensure only one live game exists.
 */
export async function saveLiveGame(game: Game): Promise<void> {
    const liveGameRef = doc(db, LIVE_GAME_COLLECTION, 'current');
    await setDoc(liveGameRef, game);
}

/**
 * Retrieves the current live game, if one exists.
 */
export async function getLiveGame(): Promise<Game | null> {
    const liveGameRef = doc(db, LIVE_GAME_COLLECTION, 'current');
    const docSnap = await getDoc(liveGameRef);
    return docSnap.exists() ? (docSnap.data() as Game) : null;
}

/**
 * Deletes the current live game document.
 */
export async function deleteLiveGame(): Promise<void> {
    const liveGameRef = doc(db, LIVE_GAME_COLLECTION, 'current');
    await deleteDoc(liveGameRef);
}

/**
 * Saves a finished game to the general history collection.
 */
export async function saveFinishedGame(game: Game): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, game.id);
    await setDoc(gameRef, game);
}

/**
 * Retrieves all finished games, sorted by date descending.
 */
export async function getFinishedGames(): Promise<Game[]> {
    const gamesCol = collection(db, GAMES_COLLECTION);
    const q = query(gamesCol, orderBy('date', 'desc'));
    const gamesSnapshot = await getDocs(q);
    const gamesList = gamesSnapshot.docs.map(doc => doc.data() as Game);
    return gamesList;
}

/**
 * Deletes one or more finished games from the history.
 */
export async function deleteFinishedGames(gameIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    gameIds.forEach(id => {
        const gameRef = doc(db, GAMES_COLLECTION, id);
        batch.delete(gameRef);
    });
    await batch.commit();
}

/**
 * Imports multiple games into the history, avoiding duplicates.
 */
export async function importGames(games: Game[]): Promise<number> {
    const batch = writeBatch(db);
    const gamesCol = collection(db, GAMES_COLLECTION);

    const gameRefs = games.map(g => doc(gamesCol, g.id));
    const gameDocs = await Promise.all(gameRefs.map(ref => getDoc(ref)));

    let newItemsCount = 0;
    gameDocs.forEach((docSnapshot, index) => {
        if (!docSnapshot.exists()) {
            batch.set(docSnapshot.ref, games[index]);
            newItemsCount++;
        }
    });

    await batch.commit();
    return newItemsCount;
}
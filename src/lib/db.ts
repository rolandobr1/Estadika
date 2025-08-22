

import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Player, Team, Tournament, Game } from '@/lib/types';
import { produce } from 'immer';

// --- Data Conversion Utilities ---

/**
 * Converts Firestore Timestamps to numbers (milliseconds since epoch).
 * This function recursively traverses an object and converts any Timestamp fields.
 */
function fromFirestore(data: any): any {
    if (!data) return data;
    if (Array.isArray(data)) {
        return data.map(fromFirestore);
    }
    if (data instanceof Timestamp) {
        return data.toMillis();
    }
    if (typeof data === 'object') {
        const newData: { [key: string]: any } = {};
        for (const key in data) {
            newData[key] = fromFirestore(data[key]);
        }
        return newData;
    }
    return data;
}

/**
 * Prepares data for Firestore by ensuring there are no undefined values,
 * which Firestore cannot handle. This is a shallow conversion.
 * For nested objects, a more complex function would be needed if they could contain undefined.
 */
function toFirestore(data: any): any {
    if (typeof data !== 'object' || data === null) return data;
    const firestoreData: { [key: string]: any } = {};
    for (const key in data) {
        const value = data[key];
        if (value !== undefined) {
             // For simplicity, we are not converting nested objects here.
             // This assumes that nested structures like 'settings' or 'teams' are clean.
            firestoreData[key] = value;
        }
    }
    return firestoreData;
}


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
    const playerList = playerSnapshot.docs.map(doc => fromFirestore(doc.data()) as Player);
    return playerList;
}

export async function savePlayer(player: Player): Promise<void> {
    const playerRef = doc(db, PLAYERS_COLLECTION, player.id);
    await setDoc(playerRef, toFirestore(player), { merge: true });
}

export async function deletePlayers(playerIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    playerIds.forEach(id => {
        const playerRef = doc(db, PLAYERS_COLLECTION, id);
        batch.delete(playerRef);
    });

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
            batch.set(docSnapshot.ref, toFirestore(players[index]));
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
    const teamList = teamSnapshot.docs.map(doc => fromFirestore(doc.data()) as Team);
    return teamList;
}

export async function saveTeam(team: Team): Promise<void> {
    const teamRef = doc(db, TEAMS_COLLECTION, team.id);
    await setDoc(teamRef, toFirestore(team), { merge: true });
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
            batch.set(docSnapshot.ref, toFirestore(teams[index]));
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
    const tournamentList = tournamentSnapshot.docs.map(doc => fromFirestore(doc.data()) as Tournament);
    return tournamentList;
}

export async function getTournamentById(id: string): Promise<Tournament | null> {
    const tournamentRef = doc(db, TOURNAMENTS_COLLECTION, id);
    const docSnap = await getDoc(tournamentRef);
    return docSnap.exists() ? (fromFirestore(docSnap.data()) as Tournament) : null;
}

export async function saveTournament(tournament: Tournament): Promise<void> {
    const tournamentRef = doc(db, TOURNAMENTS_COLLECTION, tournament.id);
    await setDoc(tournamentRef, toFirestore(tournament), { merge: true });
}

export async function deleteTournament(tournamentId: string): Promise<void> {
    const tournamentRef = doc(db, TOURNAMENTS_COLLECTION, tournamentId);
    await deleteDoc(tournamentRef);
}


// --- Game Functions ---

export async function saveLiveGame(game: Game): Promise<void> {
    const liveGameRef = doc(db, LIVE_GAME_COLLECTION, 'current');
    await setDoc(liveGameRef, toFirestore(game));
}

export async function getLiveGame(): Promise<Game | null> {
    const liveGameRef = doc(db, LIVE_GAME_COLLECTION, 'current');
    const docSnap = await getDoc(liveGameRef);
    return docSnap.exists() ? (fromFirestore(docSnap.data()) as Game) : null;
}

export async function deleteLiveGame(): Promise<void> {
    const liveGameRef = doc(db, LIVE_GAME_COLLECTION, 'current');
    await deleteDoc(liveGameRef);
}

export async function saveFinishedGame(game: Game): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, game.id);
    await setDoc(gameRef, toFirestore(game));
}

export async function getFinishedGames(): Promise<Game[]> {
    const gamesCol = collection(db, GAMES_COLLECTION);
    const q = query(gamesCol, orderBy('date', 'desc'));
    const gamesSnapshot = await getDocs(q);
    const gamesList = gamesSnapshot.docs.map(doc => fromFirestore(doc.data()) as Game);
    return gamesList;
}

export async function deleteFinishedGames(gameIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    gameIds.forEach(id => {
        const gameRef = doc(db, GAMES_COLLECTION, id);
        batch.delete(gameRef);
    });
    await batch.commit();
}

export async function importGames(games: Game[]): Promise<number> {
    const batch = writeBatch(db);
    const gamesCol = collection(db, GAMES_COLLECTION);

    const gameRefs = games.map(g => doc(gamesCol, g.id));
    const gameDocs = await Promise.all(gameRefs.map(ref => getDoc(ref)));

    let newItemsCount = 0;
    gameDocs.forEach((docSnapshot, index) => {
        if (!docSnapshot.exists()) {
            batch.set(docSnapshot.ref, toFirestore(games[index]));
            newItemsCount++;
        }
    });

    await batch.commit();
    return newItemsCount;
}
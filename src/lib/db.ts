

import { app, db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getDoc, query, orderBy, Timestamp, enableIndexedDbPersistence } from 'firebase/firestore';
import type { Player, Team, Tournament, Game } from '@/lib/types';
import { auth } from './auth';

// --- Offline Persistence ---
try {
    enableIndexedDbPersistence(db);
} catch (error: any) {
    if (error.code === 'failed-precondition') {
        console.warn("Firestore offline persistence could not be enabled. This is expected if multiple tabs are open.");
    } else if (error.code === 'unimplemented') {
        console.warn("The current browser does not support all of the features required to enable persistence.");
    }
}


const USERS_COLLECTION = 'users';
export const PLAYERS_COLLECTION = 'players';
export const TEAMS_COLLECTION = 'teams';
export const TOURNAMENTS_COLLECTION = 'tournaments';
export const GAMES_COLLECTION = 'games';


// --- Data Conversion Utilities ---

/**
 * Converts Firestore Timestamps to numbers (milliseconds since epoch)
 * This function recursively traverses an object/array.
 */
function fromFirestore(data: any): any {
    if (data === null || typeof data !== 'object') {
        return data;
    }

    if (data instanceof Timestamp) {
        return data.toMillis();
    }

    if (Array.isArray(data)) {
        return data.map(fromFirestore);
    }
    
    // It's a regular object, recursively convert its properties
    const newData: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            newData[key] = fromFirestore(data[key]);
        }
    }
    return newData;
}


/**
 * Prepares data for Firestore by recursively removing any fields with `undefined` values.
 * Firestore cannot handle `undefined`. This function operates on a deep copy.
 */
function toFirestore(data: any): any {
  // Create a deep copy to avoid mutating the original state object
  const deepCopy = JSON.parse(JSON.stringify(data));
  
  // Helper function to recursively remove undefined
  const removeUndefined = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(removeUndefined);
      }

      const newObj: { [key: string]: any } = {};
      for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const value = obj[key];
              if (value !== undefined) {
                  newObj[key] = removeUndefined(value);
              }
          }
      }
      return newObj;
  }
  
  return removeUndefined(deepCopy);
}


// --- Helper to get user-specific collection reference ---
function getUserDataPath(...pathSegments: string[]) {
    const user = auth.currentUser;
    if (!user) {
        // This will cause Firestore operations to fail if called without a logged-in user,
        // which is the desired behavior for protected data.
        return doc(db, 'invalid-path', 'user-not-logged-in');
    }
    return doc(db, USERS_COLLECTION, user.uid, ...pathSegments);
}


// --- Player Functions ---

export async function getPlayers(): Promise<Player[]> {
    if (!auth.currentUser) return [];
    const playersCol = collection(getUserDataPath(), PLAYERS_COLLECTION);
    const playerSnapshot = await getDocs(playersCol);
    const playerList = playerSnapshot.docs.map(doc => fromFirestore(doc.data()) as Player);
    return playerList;
}

export async function savePlayer(player: Player): Promise<void> {
    if (!auth.currentUser) return;
    const playerRef = doc(collection(getUserDataPath(), PLAYERS_COLLECTION), player.id);
    await setDoc(playerRef, toFirestore(player), { merge: true });
}

export async function deletePlayers(playerIds: string[]): Promise<void> {
    if (!auth.currentUser) return;
    const batch = writeBatch(db);
    const playersCollectionRef = collection(getUserDataPath(), PLAYERS_COLLECTION);
    
    playerIds.forEach(id => {
        const playerRef = doc(playersCollectionRef, id);
        batch.delete(playerRef);
    });

    // Also update any teams that contain these players
    const teams = await getTeams();
    const teamsCollectionRef = collection(getUserDataPath(), TEAMS_COLLECTION);
    teams.forEach(team => {
        const newPlayerIds = team.playerIds.filter(pid => !playerIds.includes(pid));
        if (newPlayerIds.length !== team.playerIds.length) {
            const teamRef = doc(teamsCollectionRef, team.id);
            batch.update(teamRef, { playerIds: newPlayerIds });
        }
    });

    await batch.commit();
}

export async function importPlayers(players: Player[]): Promise<number> {
    if (!auth.currentUser) return 0;
    const batch = writeBatch(db);
    const playersCol = collection(getUserDataPath(), PLAYERS_COLLECTION);
    
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
    if (!auth.currentUser) return [];
    const teamsCol = collection(getUserDataPath(), TEAMS_COLLECTION);
    const teamSnapshot = await getDocs(teamsCol);
    const teamList = teamSnapshot.docs.map(doc => fromFirestore(doc.data()) as Team);
    return teamList;
}

export async function saveTeam(team: Team): Promise<void> {
    if (!auth.currentUser) return;
    const teamRef = doc(collection(getUserDataPath(), TEAMS_COLLECTION), team.id);
    await setDoc(teamRef, toFirestore(team), { merge: true });
}

export async function deleteTeams(teamIds: string[]): Promise<void> {
    if (!auth.currentUser) return;
    const batch = writeBatch(db);
    const teamsCollectionRef = collection(getUserDataPath(), TEAMS_COLLECTION);
    teamIds.forEach(id => {
        const teamRef = doc(teamsCollectionRef, id);
        batch.delete(teamRef);
    });
    await batch.commit();
}

export async function importTeams(teams: Team[]): Promise<number> {
    if (!auth.currentUser) return 0;
    const batch = writeBatch(db);
    const teamsCol = collection(getUserDataPath(), TEAMS_COLLECTION);

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
    if (!auth.currentUser) return [];
    const tournamentsCol = collection(getUserDataPath(), TOURNAMENTS_COLLECTION);
    const tournamentSnapshot = await getDocs(tournamentsCol);
    const tournamentList = tournamentSnapshot.docs.map(doc => fromFirestore(doc.data()) as Tournament);
    return tournamentList;
}

export async function getTournamentById(id: string): Promise<Tournament | null> {
    if (!auth.currentUser) return null;
    const tournamentRef = doc(collection(getUserDataPath(), TOURNAMENTS_COLLECTION), id);
    const docSnap = await getDoc(tournamentRef);
    return docSnap.exists() ? (fromFirestore(docSnap.data()) as Tournament) : null;
}

export async function saveTournament(tournament: Tournament): Promise<void> {
    if (!auth.currentUser) return;
    const tournamentRef = doc(collection(getUserDataPath(), TOURNAMENTS_COLLECTION), tournament.id);
    await setDoc(tournamentRef, toFirestore(tournament), { merge: true });
}

export async function deleteTournament(tournamentId: string): Promise<void> {
    if (!auth.currentUser) return;
    const tournamentRef = doc(collection(getUserDataPath(), TOURNAMENTS_COLLECTION), tournamentId);
    await deleteDoc(tournamentRef);
}


// --- Game Functions ---
const LIVE_GAME_COLLECTION = 'live-game';
const LIVE_GAME_ID = 'singleton';

export async function saveLiveGame(game: Game): Promise<void> {
    if (!auth.currentUser) return;
    const liveGameRef = doc(collection(getUserDataPath(), LIVE_GAME_COLLECTION), LIVE_GAME_ID);
    await setDoc(liveGameRef, toFirestore(game));
}

export async function getLiveGame(): Promise<Game | null> {
    if (!auth.currentUser) return null;
    const liveGameRef = doc(collection(getUserDataPath(), LIVE_GAME_COLLECTION), LIVE_GAME_ID);
    const snapshot = await getDoc(liveGameRef);
    if (!snapshot.exists()) return null;
    return fromFirestore(snapshot.data()) as Game;
}

export async function deleteLiveGame(): Promise<void> {
    if (!auth.currentUser) return;
    const liveGameRef = doc(collection(getUserDataPath(), LIVE_GAME_COLLECTION), LIVE_GAME_ID);
    await deleteDoc(liveGameRef);
}

export async function saveFinishedGame(game: Game): Promise<void> {
    if (!auth.currentUser) return;
    const gameRef = doc(collection(getUserDataPath(), GAMES_COLLECTION), game.id);
    const cleanGame = toFirestore(game);
    await setDoc(gameRef, cleanGame);
}

/**
 * Saves a finished game, updates the tournament if applicable, and deletes the live game
 * in a single atomic batch operation. This is safe to use offline.
 */
export async function finishAndSaveGameBatch(finishedGame: Game, updatedTournament?: Tournament): Promise<void> {
    if (!auth.currentUser) return;

    const batch = writeBatch(db);

    // 1. Reference to the new finished game in the 'games' collection
    const finishedGameRef = doc(collection(getUserDataPath(), GAMES_COLLECTION), finishedGame.id);
    batch.set(finishedGameRef, toFirestore(finishedGame));

    // 2. Reference to the live game to be deleted
    const liveGameRef = doc(collection(getUserDataPath(), LIVE_GAME_COLLECTION), LIVE_GAME_ID);
    batch.delete(liveGameRef);

    // 3. If it's a tournament game, reference the tournament to update it
    if (updatedTournament) {
        const tournamentRef = doc(collection(getUserDataPath(), TOURNAMENTS_COLLECTION), updatedTournament.id);
        batch.set(tournamentRef, toFirestore(updatedTournament));
    }
    
    // Commit all operations as a single atomic unit
    await batch.commit();
}


export async function getFinishedGames(): Promise<Game[]> {
    if (!auth.currentUser) return [];
    const gamesCol = collection(getUserDataPath(), GAMES_COLLECTION);
    const q = query(gamesCol, orderBy('date', 'desc'));
    const gamesSnapshot = await getDocs(q);
    const gamesList = gamesSnapshot.docs.map(doc => fromFirestore(doc.data()) as Game);
    return gamesList;
}

export async function deleteFinishedGames(gameIds: string[]): Promise<void> {
    if (!auth.currentUser) return;
    const batch = writeBatch(db);
    const gamesCollectionRef = collection(getUserDataPath(), GAMES_COLLECTION);
    gameIds.forEach(id => {
        const gameRef = doc(gamesCollectionRef, id);
        batch.delete(gameRef);
    });
    await batch.commit();
}

export async function importGames(games: Game[]): Promise<number> {
    if (!auth.currentUser) return 0;
    const batch = writeBatch(db);
    const gamesCol = collection(getUserDataPath(), GAMES_COLLECTION);

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

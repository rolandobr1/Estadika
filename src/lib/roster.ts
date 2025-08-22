'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getDoc, query, where } from 'firebase/firestore';
import type { Player, Team } from '@/lib/types';

const PLAYERS_COLLECTION = 'players';
const TEAMS_COLLECTION = 'teams';

// Player Functions
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
    
    // Using Promise.all to fetch all documents in parallel for checking existence
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


// Team Functions
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

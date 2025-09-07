

import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously as firebaseSignInAnonymously,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile,
    type User
} from 'firebase/auth';
import { app } from './firebase';

export { type User };
export const auth = getAuth(app);

export const setAuthPersistence = async (rememberMe: boolean) => {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
}

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await setAuthPersistence(true); // Always remember Google sign-ins
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error during Google sign-in:", error);
        throw error;
    }
};

export const signInAnonymously = async () => {
    try {
        await setAuthPersistence(true); // Persist guest sessions locally
        await firebaseSignInAnonymously(auth);
    } catch (error) {
        console.error("Error during anonymous sign-in:", error);
        throw error;
    }
}

export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
    try {
        await setAuthPersistence(true); // Remember users who sign up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Error signing up with email:", error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
    try {
        // Persistence is set in the component before calling this
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in with email:", error);
        throw error;
    }
};

export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

export const updateUserProfile = async (displayName: string) => {
    if (!auth.currentUser) {
        throw new Error("No user is signed in to update the profile.");
    }
    try {
        await updateProfile(auth.currentUser, { displayName });
        // The onAuthStateChanged listener will pick up the change automatically
    } catch (error) {
        console.error("Error updating user profile:", error);
        throw error;
    }
};

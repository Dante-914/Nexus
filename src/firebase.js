import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, 
  updateProfile, 
  } from "firebase/auth";
  import {getFirestore} from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgWyZMSAhhAZSnig1sWu8rQ-8oYg4dzJY",
  authDomain: "all-purpose-app-b4ec7.firebaseapp.com",
  projectId: "all-purpose-app-b4ec7",
  storageBucket: "all-purpose-app-b4ec7.firebasestorage.app",
  messagingSenderId: "955592643540",
  appId: "1:955592643540:web:702daefdfc4bbf0f483c41"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Google Sign In
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Email/Password Sign Up
export const signUpWithEmail = async (email, password, username) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Update profile with username
    await updateProfile(userCredential.user, {
      displayName: username
    });
    return userCredential.user;
  } catch (error) {
    console.error("Error signing up with email:", error);
    throw error;
  }
};

// Email/Password Sign In
export const signInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in with email:", error);
    throw error;
  }
};

// Logout
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};
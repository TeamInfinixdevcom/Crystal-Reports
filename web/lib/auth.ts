import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    return result.user;
  } catch (error: unknown) {
    if (
      error instanceof FirebaseError &&
      error.code === "auth/cancelled-popup-request"
    ) {
      return null;
    }

    throw error;
  }
}

export async function signOutUser() {
  await signOut(auth);
  window.location.reload();
}
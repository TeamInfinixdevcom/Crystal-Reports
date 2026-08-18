import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(
      auth,
      googleProvider,
    );

    return result.user;
  } catch (error: unknown) {
    if (
      error instanceof FirebaseError &&
      error.code === "auth/cancelled-popup-request"
    ) {
      return null;
    }

    console.error("ERROR GOOGLE LOGIN:", error);

    throw error;
  }
}

export async function getGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);

    return result?.user ?? null;
  } catch (error: unknown) {
    console.error(
      "ERROR GOOGLE REDIRECT:",
      error,
    );

    throw error;
  }
}

export async function signOutUser() {
  await signOut(auth);
  window.location.reload();
}
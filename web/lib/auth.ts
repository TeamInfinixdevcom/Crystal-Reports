import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import {FirebaseError} from "firebase/app";

import {auth} from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const isMobile =
      typeof window !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      await signInWithRedirect(
        auth,
        googleProvider,
      );

      return null;
    }

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
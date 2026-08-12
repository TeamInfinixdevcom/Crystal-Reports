import {
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import type { User } from "../types/user";

export async function getUserProfile(userId: string) {
  try {
    console.log("=== FIRESTORE PROFILE CHECK ===");
    console.log("PROJECT:", db.app.options.projectId);
    console.log("AUTH UID:", userId);

    const currentUser = auth.currentUser;

    console.log("CURRENT AUTH UID:", currentUser?.uid ?? null);

    if (!currentUser) {
      console.log("NO CURRENT FIREBASE USER");
      return null;
    }

    // Forzamos la renovación del token de Firebase Auth
    await currentUser.getIdToken(true);

    console.log("TOKEN REFRESHED");

    const userRef = doc(db, "users", userId);

    console.log("FIRESTORE PATH:", userRef.path);

    const snapshot = await getDocFromServer(userRef);

    console.log("DOCUMENT EXISTS:", snapshot.exists());

    if (!snapshot.exists()) {
      console.log("DOCUMENT DATA: null");
      return null;
    }

    const data = snapshot.data();

    console.log("DOCUMENT DATA:", data);

    return data as User;
  } catch (error) {
    console.error("FIRESTORE PROFILE ERROR:", error);

    if (error instanceof Error) {
      console.error("ERROR MESSAGE:", error.message);
    }

    throw error;
  }
}

export async function createUserProfile(
  userId: string,
  data: Omit<User, "id" | "createdAt" | "updatedAt">,
) {
  const userRef = doc(db, "users", userId);

  await setDoc(userRef, {
    ...data,
    id: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
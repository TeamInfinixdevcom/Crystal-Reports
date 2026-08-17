import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

export async function createTravel(userId: string) {
  const travelsRef = collection(db, "users", userId, "travels");

  const travelRef = await addDoc(travelsRef, {
    userId,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return travelRef.id;
}
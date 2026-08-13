import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

admin.initializeApp();

export const createUserProfile = functions
  .runWith({
    maxInstances: 10,
  })
  .auth.user()
  .onCreate(async (user) => {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(user.uid);

    const existingProfile = await userRef.get();

    if (existingProfile.exists) {
      return;
    }

    await userRef.set({
      id: user.uid,
      name: user.displayName ?? "Usuario",
      identification: "",
      email: user.email ?? "",
      role: "user",
      travelAllowance: 0,
      currency: "CRC",
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

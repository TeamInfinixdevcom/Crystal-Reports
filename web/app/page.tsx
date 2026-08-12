"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../lib/firebase";
import { signInWithGoogle, signOutUser } from "../lib/auth";
import { getUserProfile } from "../lib/users";
import type { User as UserProfile } from "../types/user";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userProfile = await getUserProfile(currentUser.uid);

      console.log("AUTH UID:", currentUser.uid);
      console.log("FIRESTORE PROFILE:", userProfile);

      setProfile(userProfile);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
          Crystal Reports Cloud
        </div>

        {!user ? (
          <>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Controlá tus viáticos de forma simple.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Registrá tus viajes, cargá tus facturas y mantené el control de
              tus gastos diarios, semanales y mensuales.
            </p>

            <button
              onClick={() => signInWithGoogle()}
              className="mt-10 rounded-xl bg-white px-6 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
            >
              Iniciar sesión con Google
            </button>
          </>
        ) : profile ? (
          <>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              ¡Bienvenido, {profile.name}!
            </h1>

            <p className="mt-6 text-lg text-slate-400">
              Perfil encontrado correctamente en Firestore.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
              <p>
                <span className="text-slate-400">Correo:</span>{" "}
                {profile.email}
              </p>

              <p className="mt-2">
                <span className="text-slate-400">Rol:</span>{" "}
                {profile.role}
              </p>
            </div>

            <button
              onClick={signOutUser}
              className="mt-8 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-medium transition hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-semibold">
              Usuario no autorizado
            </h1>

            <p className="mt-4 max-w-lg text-slate-400">
              Tu cuenta de Google está autenticada, pero no tiene un perfil
              registrado en Crystal Reports Cloud.
            </p>

            <button
              onClick={signOutUser}
              className="mt-8 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-medium transition hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </>
        )}
      </section>
    </main>
  );
}
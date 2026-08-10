"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../lib/firebase";
import { signInWithGoogle, signOutUser } from "../lib/auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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

        {user ? (
          <>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              ¡Bienvenido, {user.displayName || "usuario"}!
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Has iniciado sesión correctamente con Google.
            </p>

            <p className="mt-3 text-sm text-slate-500">
              {user.email}
            </p>

            <div className="mt-10 flex gap-4">
              <button
                onClick={signOutUser}
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Cerrar sesión
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Controlá tus viáticos de forma simple.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Registrá tus viajes, cargá tus facturas y mantené el control de
              tus gastos diarios, semanales y mensuales.
            </p>

            <div className="mt-10">
              <button
                onClick={() => signInWithGoogle()}
                className="rounded-xl bg-white px-6 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
              >
                Iniciar sesión con Google
              </button>
            </div>

            <div className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="font-medium">Viajes</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Registrá cada viaje realizado.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="font-medium">Facturas</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Subí tus comprobantes y procesá sus montos.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="font-medium">Viáticos</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Conocé cuánto llevás gastado y cuánto te queda.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
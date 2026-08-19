"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../lib/firebase";
import {
  getGoogleRedirectResult,
  signInWithGoogle,
  signOutUser,
} from "../lib/auth";
import { getUserProfile } from "../lib/users";
import type { User as UserProfile } from "../types/user";

import Header from "../components/dashboard/Header";
import TravelHero from "../components/dashboard/TravelHero";
import QuickAccess from "../components/dashboard/QuickAccess";
import Summary from "../components/dashboard/Summary";
import PdfExpedient from "../components/dashboard/PdfExpedient";
import DesktopNav from "../components/navigation/DesktopNav";
import MobileNav from "../components/navigation/MobileNav";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [redirectStatus, setRedirectStatus] = useState(
    "Esperando resultado de Google...",
  );
  const [redirectError, setRedirectError] = useState<string | null>(
    null,
  );
  const [authStatus, setAuthStatus] = useState(
    "Esperando estado de Firebase Auth...",
  );

  useEffect(() => {
    let mounted = true;

    const handleRedirectResult = async () => {
      try {
        setRedirectStatus("Procesando retorno de Google...");

        const redirectUser = await getGoogleRedirectResult();

        if (!mounted) return;

        if (redirectUser) {
          setRedirectStatus(
            `Google devolvió usuario: ${redirectUser.email ?? "sin email"}`,
          );
        } else {
          setRedirectStatus(
            "Google no devolvió usuario mediante getRedirectResult().",
          );
        }
      } catch (error: unknown) {
        if (!mounted) return;

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setRedirectStatus("ERROR en getRedirectResult()");
        setRedirectError(message);

        console.error(
          "ERROR PROCESANDO LOGIN GOOGLE:",
          error,
        );
      }
    };

    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!mounted) return;

        if (currentUser) {
          setAuthStatus(
            `Firebase Auth tiene usuario: ${currentUser.email ?? "sin email"}`,
          );
        } else {
          setAuthStatus(
            "Firebase Auth: currentUser es NULL",
          );
        }

        setUser(currentUser);
        setLoadingAuth(false);

        if (!currentUser) {
          setProfile(null);
          setLoadingProfile(false);
          return;
        }

        setLoadingProfile(true);

        try {
          const userProfile = await getUserProfile(
            currentUser.uid,
          );

          if (!mounted) return;

          setProfile(userProfile);
        } catch (error) {
          console.error(
            "ERROR CARGANDO PERFIL:",
            error,
          );

          if (!mounted) return;

          setProfile(null);
        } finally {
          if (mounted) {
            setLoadingProfile(false);
          }
        }
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /*
   * Mientras Firebase Auth todavía está determinando
   * si existe una sesión, mostramos solamente Cargando.
   */
  if (loadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] text-[#1d1d1f]">
        <p className="text-sm text-[#8a857c]">
          Cargando...
        </p>
      </main>
    );
  }

  /*
   * Usuario no autenticado.
   */
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-6">
        <section className="w-full max-w-md text-center">
          <p className="text-sm font-medium text-[#a18d6d]">
            Crystal Reports Cloud
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#1d1d1f]">
            Reportá tus viajes fácilmente.
          </h1>

          <p className="mt-4 text-[#77736c]">
            Registrá tus viajes y mantené el control de tus viáticos.
          </p>

          <button
            onClick={() => signInWithGoogle()}
            className="mt-8 w-full rounded-2xl bg-[#1d1d1f] px-6 py-4 font-medium text-white transition-all duration-150 hover:bg-[#333] active:scale-[0.98]"
          >
            Iniciar sesión con Google
          </button>

          {/* Diagnóstico temporal */}
          <div className="mt-8 rounded-2xl border border-[#e4e0d9] bg-white p-5 text-left text-xs text-[#55514a]">
            <p className="mb-3 font-semibold text-[#1d1d1f]">
              Diagnóstico temporal
            </p>

            <div className="space-y-2">
              <p>
                <strong>Redirect:</strong>{" "}
                {redirectStatus}
              </p>

              <p>
                <strong>Firebase Auth:</strong>{" "}
                {authStatus}
              </p>

              {redirectError && (
                <p className="break-words text-red-600">
                  <strong>Error:</strong>{" "}
                  {redirectError}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  /*
   * Firebase Auth ya confirmó al usuario,
   * pero todavía estamos consultando su perfil.
   *
   * IMPORTANTE:
   * Aquí ya NO mostramos "Usuario no autorizado".
   */
  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] text-[#1d1d1f]">
        <p className="text-sm text-[#8a857c]">
          Cargando tu perfil...
        </p>
      </main>
    );
  }

  /*
   * Ya terminó la consulta de Firestore.
   * Si no existe perfil, ahora sí mostramos
   * que el usuario no está autorizado.
   */
  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-6">
        <section className="text-center">
          <h1 className="text-3xl font-semibold text-[#1d1d1f]">
            Usuario no autorizado
          </h1>

          <p className="mt-4 text-[#77736c]">
            Tu cuenta no tiene un perfil registrado.
          </p>

          <button
            onClick={signOutUser}
            className="mt-8 rounded-xl border border-[#e4e0d9] bg-white px-6 py-3 text-[#55514a] transition active:scale-[0.97]"
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#1d1d1f]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col">

        {/* Navegación desktop */}
        <header className="hidden items-center justify-between border-b border-[#eeeae4] bg-white/80 px-8 py-5 backdrop-blur-md lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6f1e9] text-lg">
              ◇
            </div>

            <span className="font-semibold tracking-tight">
              Crystal Reports Cloud
            </span>
          </div>

          <DesktopNav active="inicio" />
        </header>

        {/* Header móvil */}
        <header className="flex items-center justify-between px-5 py-5 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6f1e9] text-lg">
            ◇
          </div>

          <button
            onClick={signOutUser}
            className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm transition active:scale-95"
          >
            Salir
          </button>
        </header>

        {/* Contenido principal */}
        <div className="flex-1 px-5 pb-28 pt-8 sm:px-8 lg:px-10 xl:px-14 2xl:px-16 lg:pt-12">

          <Header name={profile.name} />

          <TravelHero />

          <QuickAccess />

          <Summary />

          <PdfExpedient />

        </div>

        {/* Footer */}
        <footer className="hidden border-t border-[#eeeae4] py-7 text-center lg:block">
          <p className="text-sm font-medium text-[#8a857c]">
            Crystal Reports Cloud
          </p>

          <p className="mt-2 text-xs text-[#aaa49a]">
            © 2026 Infinix Dev. All rights reserved.
          </p>

          <p className="mt-1 text-xs text-[#aaa49a]">
            Developed by Infinix Dev
          </p>
        </footer>

        {/* Navegación móvil */}
        <MobileNav active="inicio" />

      </div>
    </main>
  );
}
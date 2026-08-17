"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import { signOutUser } from "../../lib/auth";
import DesktopNav from "../../components/navigation/DesktopNav";
import MobileNav from "../../components/navigation/MobileNav";

type ProfileData = {
  name?: string;
  email?: string;
  identification?: string;
  phone?: string;
  monthlyAllowance?: number;
  currency?: string;
};

export default function PerfilPage() {
  const [profile, setProfile] =
    useState<ProfileData | null>(null);

  const [identification, setIdentification] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [monthlyAllowance, setMonthlyAllowance] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setLoading(false);
            return;
          }

          try {
            const profileRef = doc(
              db,
              "users",
              user.uid,
            );

            const snapshot =
              await getDoc(profileRef);

            const data =
              snapshot.exists()
                ? (snapshot.data() as ProfileData)
                : {};

            const profileData: ProfileData = {
              name:
                data.name ??
                user.displayName ??
                "",

              email:
                data.email ??
                user.email ??
                "",

              identification:
                data.identification ??
                "",

              phone:
                data.phone ??
                "",

              monthlyAllowance:
                typeof data.monthlyAllowance ===
                "number"
                  ? data.monthlyAllowance
                  : 0,

              currency:
                data.currency ??
                "CRC",
            };

            setProfile(profileData);

            setIdentification(
              profileData.identification ?? "",
            );

            setPhone(
              profileData.phone ?? "",
            );

            setMonthlyAllowance(
              profileData.monthlyAllowance
                ? profileData.monthlyAllowance.toString()
                : "",
            );
          } catch (err) {
            console.error(
              "ERROR CARGANDO PERFIL:",
              err,
            );

            setError(
              "No pudimos cargar tu perfil.",
            );
          } finally {
            setLoading(false);
          }
        },
      );

    return unsubscribe;
  }, []);

  const handleSave = async () => {
    const user =
      auth.currentUser;

    if (!user) {
      setError(
        "Tu sesión no está disponible.",
      );
      return;
    }

    setError("");
    setMessage("");

    const allowance =
      Number(
        monthlyAllowance
          .replace(/\./g, "")
          .replace(",", "."),
      );

    if (
      monthlyAllowance.trim() !== "" &&
      (!Number.isFinite(allowance) ||
        allowance < 0)
    ) {
      setError(
        "El viático mensual debe ser un monto válido.",
      );
      return;
    }

    try {
      setSaving(true);

      const profileRef = doc(
        db,
        "users",
        user.uid,
      );

      await setDoc(
        profileRef,
        {
          identification:
            identification.trim(),

          phone:
            phone.trim(),

          monthlyAllowance:
            allowance,

          currency:
            "CRC",

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      setProfile((current) => ({
        ...(current ?? {}),

        identification:
          identification.trim(),

        phone:
          phone.trim(),

        monthlyAllowance:
          allowance,

        currency:
          "CRC",
      }));

      setMessage(
        "Perfil actualizado correctamente.",
      );
    } catch (err) {
      console.error(
        "ERROR GUARDANDO PERFIL:",
        err,
      );

      setError(
        "No pudimos guardar los cambios.",
      );
    } finally {
      setSaving(false);
    }
  };

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

          <DesktopNav active="perfil" />

          <button
            onClick={signOutUser}
            className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-95"
          >
            Salir
          </button>
        </header>

        {/* Header móvil */}
        <header className="flex items-center justify-between px-5 py-5 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6f1e9] text-lg">
              ◇
            </div>

            <span className="text-sm font-semibold">
              Crystal Reports Cloud
            </span>
          </div>

          <button
            onClick={signOutUser}
            className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition active:scale-95"
          >
            Salir
          </button>
        </header>

        {/* Contenido */}
        <div className="flex-1 px-5 pb-28 pt-8 sm:px-8 lg:px-10 xl:px-14 2xl:px-16 lg:pt-12">

          <section>
            <p className="text-sm font-medium text-[#a18d6d]">
              Crystal Reports Cloud
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Mi perfil
            </h1>

            <p className="mt-2 max-w-2xl text-[#77736c]">
              Consultá y administrá tu información personal.
            </p>
          </section>

          {loading ? (
            <section className="mt-10 flex min-h-[300px] items-center justify-center rounded-[28px] border border-[#eeeae4] bg-white">
              <p className="text-sm text-[#8a857c]">
                Cargando perfil...
              </p>
            </section>
          ) : (
            <section className="mt-10 rounded-[28px] border border-[#eeeae4] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-8">

              {/* Encabezado */}
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f1e9] text-2xl">
                  👤
                </div>

                <div>
                  <h2 className="text-xl font-semibold">
                    Mi información
                  </h2>

                  <p className="mt-1 text-sm text-[#77736c]">
                    Mantené actualizados tus datos.
                  </p>
                </div>
              </div>

              {/* Información personal */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold">
                  Información personal
                </h3>

                <div className="mt-4 grid gap-5 sm:grid-cols-2">

                  {/* Nombre */}
                  <div>
                    <label className="text-xs font-medium text-[#8a857c]">
                      Nombre completo
                    </label>

                    <input
                      value={
                        profile?.name ?? ""
                      }
                      disabled
                      className="mt-2 w-full rounded-xl border border-[#eeeae4] bg-[#f7f5f2] px-4 py-3 text-sm text-[#77736c] outline-none"
                    />

                    <p className="mt-1 text-[11px] text-[#aaa49a]">
                      Este dato proviene de tu cuenta.
                    </p>
                  </div>

                  {/* Correo */}
                  <div>
                    <label className="text-xs font-medium text-[#8a857c]">
                      Correo electrónico
                    </label>

                    <input
                      value={
                        profile?.email ?? ""
                      }
                      disabled
                      className="mt-2 w-full rounded-xl border border-[#eeeae4] bg-[#f7f5f2] px-4 py-3 text-sm text-[#77736c] outline-none"
                    />

                    <p className="mt-1 text-[11px] text-[#aaa49a]">
                      Este dato proviene de tu cuenta.
                    </p>
                  </div>

                  {/* Identificación */}
                  <div>
                    <label className="text-xs font-medium text-[#8a857c]">
                      Identificación
                    </label>

                    <input
                      type="text"
                      value={identification}
                      onChange={(event) =>
                        setIdentification(
                          event.target.value,
                        )
                      }
                      placeholder="Ej. 1-2345-6789"
                      className="mt-2 w-full rounded-xl border border-[#e4e0d9] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#b8a98f]"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="text-xs font-medium text-[#8a857c]">
                      Teléfono
                    </label>

                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(
                          event.target.value,
                        )
                      }
                      placeholder="Ej. 8888-8888"
                      className="mt-2 w-full rounded-xl border border-[#e4e0d9] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#b8a98f]"
                    />
                  </div>

                </div>
              </div>

              {/* Viáticos */}
              <div className="mt-10 border-t border-[#eeeae4] pt-8">

                <h3 className="text-sm font-semibold">
                  Configuración de viáticos
                </h3>

                <p className="mt-1 text-sm text-[#77736c]">
                  Este monto se utiliza como límite mensual
                  de referencia.
                </p>

                <div className="mt-5 max-w-md">

                  <label className="text-xs font-medium text-[#8a857c]">
                    Viático mensual
                  </label>

                  <div className="mt-2 flex overflow-hidden rounded-xl border border-[#e4e0d9] bg-white">

                    <div className="flex items-center border-r border-[#e4e0d9] bg-[#f7f5f2] px-4 text-sm font-medium text-[#77736c]">
                      ₡
                    </div>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyAllowance}
                      onChange={(event) =>
                        setMonthlyAllowance(
                          event.target.value,
                        )
                      }
                      placeholder="75000"
                      className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
                    />

                  </div>

                  <p className="mt-2 text-xs text-[#aaa49a]">
                    Este monto queda configurado para cada
                    mes hasta que lo modifiqués.
                  </p>

                </div>

              </div>

              {/* Mensajes */}
              {error && (
                <div className="mt-6 rounded-xl bg-[#fff4f2] px-4 py-3 text-sm text-[#9a5b50]">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-6 rounded-xl bg-[#f1f7f1] px-4 py-3 text-sm text-[#54705a]">
                  {message}
                </div>
              )}

              {/* Guardar */}
              <div className="mt-8 flex justify-end">

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-[#1d1d1f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#333] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>

              </div>

            </section>
          )}

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
        <MobileNav active="perfil" />

      </div>
    </main>
  );
}
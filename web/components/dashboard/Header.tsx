"use client";

import { signOutUser } from "../../lib/auth";

type HeaderProps = {
  name: string;
};

export default function Header({ name }: HeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[#a18d6d]">
          Crystal Reports Cloud
        </p>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Hola, {name}
        </h1>

        <p className="mt-1 text-sm text-[#8a857c]">
          Bienvenido a tu panel
        </p>
      </div>

      <button
        onClick={signOutUser}
        className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition-all duration-150 hover:bg-[#f6f3ee] active:scale-[0.96]"
      >
        Salir
      </button>
    </header>
  );
}
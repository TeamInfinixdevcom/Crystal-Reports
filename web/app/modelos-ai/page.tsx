"use client";

import {useState} from "react";
import {listGeminiModels} from "../../lib/functions";

type GeminiModel = {
  name: string;
  displayName?: string;
};

export default function ModelosAIPage() {
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadModels = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listGeminiModels();

      setModels(response.data.models);
    } catch (err) {
      console.error("ERROR LISTANDO MODELOS:", err);

      setError(
        "No fue posible consultar los modelos de Gemini.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9f7] p-8 text-[#1d1d1f]">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold">
          Modelos disponibles de Gemini
        </h1>

        <p className="mt-2 text-sm text-[#77736c]">
          Consulta temporal para identificar qué modelos
          están disponibles para nuestra API key.
        </p>

        <button
          type="button"
          onClick={handleLoadModels}
          disabled={loading}
          className="mt-6 rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading
            ? "Consultando..."
            : "Consultar modelos"}
        </button>

        {error && (
          <div className="mt-6 rounded-2xl bg-[#fff4f2] p-4 text-sm text-[#9a5b50]">
            {error}
          </div>
        )}

        {models.length > 0 && (
          <div className="mt-8 space-y-3">
            {models.map((model) => (
              <div
                key={model.name}
                className="rounded-2xl border border-[#eeeae4] bg-white p-4"
              >
                <p className="font-medium">
                  {model.displayName ?? "Sin nombre"}
                </p>

                <p className="mt-1 text-xs text-[#77736c]">
                  {model.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
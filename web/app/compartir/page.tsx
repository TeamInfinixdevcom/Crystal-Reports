"use client";

import {useEffect, useState} from "react";

type SharedFileMessage = {
  type: "SHARED_FILE";
  file: File;
};

export default function CompartirPage() {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (
      event: MessageEvent<SharedFileMessage>,
    ) => {
      if (
        event.data?.type !== "SHARED_FILE" ||
        !(event.data.file instanceof File)
      ) {
        return;
      }

      setFile(event.data.file);
    };

    navigator.serviceWorker.addEventListener(
      "message",
      handleMessage,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        handleMessage,
      );
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#1d1d1f]">
      <div className="mx-auto min-h-screen max-w-[900px] px-5 py-8 sm:px-8">

        <header>
          <p className="text-sm font-medium text-[#a18d6d]">
            Crystal Reports Cloud
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Factura compartida
          </h1>

          <p className="mt-2 text-[#77736c]">
            Revisá el documento antes de procesarlo.
          </p>
        </header>

        <section className="mt-10 rounded-[28px] border border-[#eeeae4] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-8">

          {!file ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f1e9] text-3xl">
                📄
              </div>

              <h2 className="mt-6 text-xl font-semibold">
                Esperando una factura
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77736c]">
                Compartí una factura desde tu teléfono
                utilizando el menú de compartir.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 rounded-2xl border border-[#eeeae4] bg-[#faf9f7] p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl">
                  📄
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {file.name}
                  </p>

                  <p className="mt-1 text-xs text-[#8a857c]">
                    {file.type || "Archivo"}
                    {" · "}
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[20px] border border-[#eeeae4] bg-[#f5f3ef]">
                {file.type === "application/pdf" ? (
                  <iframe
                    title="Vista previa de factura"
                    src={URL.createObjectURL(file)}
                    className="h-[600px] w-full"
                  />
                ) : (
                  <div className="flex min-h-[400px] items-center justify-center p-6">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="max-h-[600px] max-w-full rounded-xl object-contain"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl bg-[#f8f5f0] p-5">
                <div className="flex gap-4">
                  <div className="text-lg">
                    ✨
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#55514a]">
                      Documento recibido correctamente
                    </p>

                    <p className="mt-1 text-sm leading-6 text-[#77736c]">
                      Esta es una vista previa. En el siguiente
                      paso conectaremos el documento con el
                      procesamiento automático de Crystal Reports.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

        </section>

        <footer className="py-10 text-center">
          <p className="text-xs text-[#aaa49a]">
            © 2026 Infinix Dev. All rights reserved.
          </p>
        </footer>

      </div>
    </main>
  );
}
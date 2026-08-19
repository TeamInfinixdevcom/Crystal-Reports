"use client";

import {useEffect, useState} from "react";

const DB_NAME = "crystal-reports-share";
const DB_VERSION = 1;
const STORE_NAME = "shared-files";

type StoredSharedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
  createdAt: number;
};

type SharedFileMessage = {
  type: "SHARED_FILE_AVAILABLE";
  fileId: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getSharedFile(
  fileId: string,
): Promise<File | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly",
    );

    const store = transaction.objectStore(
      STORE_NAME,
    );

    const request = store.get(fileId);

    request.onsuccess = () => {
      const data =
        request.result as StoredSharedFile | undefined;

      if (!data?.file) {
        resolve(null);
        return;
      }

      resolve(data.file);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function deleteSharedFile(
  fileId: string,
) {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    const store = transaction.objectStore(
      STORE_NAME,
    );

    const request = store.delete(fileId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export default function CompartirPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;

    const loadSharedFile = async (
      fileId: string,
    ) => {
      try {
        setLoading(true);

        const sharedFile =
          await getSharedFile(fileId);

        if (!mounted) return;

        if (!sharedFile) {
          setError(
            "No se encontró el archivo compartido.",
          );
          setLoading(false);
          return;
        }

        setFile(sharedFile);
        setLoading(false);

        await deleteSharedFile(fileId);
      } catch (error) {
        console.error(
          "ERROR RECUPERANDO ARCHIVO COMPARTIDO:",
          error,
        );

        if (!mounted) return;

        setError(
          "No fue posible recuperar el archivo compartido.",
        );
        setLoading(false);
      }
    };

    const handleMessage = (
      event: MessageEvent<SharedFileMessage>,
    ) => {
      if (
        event.data?.type !==
        "SHARED_FILE_AVAILABLE"
      ) {
        return;
      }

      if (!event.data.fileId) {
        return;
      }

      loadSharedFile(event.data.fileId);
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleMessage,
      );
    }

    const params = new URLSearchParams(
      window.location.search,
    );

    const fileId = params.get("fileId");

    if (fileId) {
      loadSharedFile(fileId);
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleMessage,
        );
      }
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

          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f1e9] text-3xl">
                📥
              </div>

              <h2 className="mt-6 text-xl font-semibold">
                Recibiendo factura...
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77736c]">
                Estamos preparando el documento para
                procesarlo.
              </p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f1e9] text-3xl">
                ⚠️
              </div>

              <h2 className="mt-6 text-xl font-semibold">
                No pudimos recibir la factura
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77736c]">
                {error}
              </p>
            </div>
          ) : !file ? (
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
                    {(file.size / 1024 / 1024).toFixed(
                      2,
                    )}{" "}
                    MB
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
                      La factura fue recibida correctamente
                      desde el menú de compartir.
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
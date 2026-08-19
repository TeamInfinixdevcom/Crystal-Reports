"use client";

import {useEffect, useState} from "react";
import {doc, serverTimestamp, updateDoc} from "firebase/firestore";

import {auth, db} from "../../lib/firebase";
import {
  uploadInvoice,
  type ProcessedInvoice,
} from "../../lib/invoices";

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
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
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
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
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
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
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
  const [fileUrl, setFileUrl] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [processedInvoice, setProcessedInvoice] =
    useState<ProcessedInvoice | null>(null);

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
        setError(null);

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

  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);

    setFileUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleProcessInvoice = async () => {
    if (!file || processing || confirming) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Tu sesión ha expirado. Iniciá sesión nuevamente.",
        );
      }

      const result = await uploadInvoice(
        currentUser.uid,
        null,
        file,
      );

      setProcessedInvoice(result);
    } catch (error) {
      console.error(
        "ERROR AL PROCESAR FACTURA COMPARTIDA:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "No pudimos procesar la factura. Intentá nuevamente.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmInvoice = async () => {
    if (
      !processedInvoice ||
      confirming
    ) {
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Tu sesión ha expirado. Iniciá sesión nuevamente.",
        );
      }

      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "invoices",
          processedInvoice.invoiceId,
        ),
        {
          status: "confirmed",
          updatedAt: serverTimestamp(),
          processingError: null,
        },
      );

      setConfirming(false);
    } catch (error) {
      console.error(
        "ERROR CONFIRMANDO FACTURA:",
        error,
      );

      setError(
        "No pudimos confirmar la factura. Intentá nuevamente.",
      );

      setConfirming(false);
    }
  };

  const formatAmount = (
    amount: number | null,
    currency: "CRC" | null,
  ) => {
    if (
      amount === null ||
      amount === undefined
    ) {
      return "No identificado";
    }

    if (currency === "CRC") {
      return `₡${amount.toLocaleString(
        "es-CR",
      )}`;
    }

    return amount.toLocaleString(
      "es-CR",
    );
  };

  const invoiceData =
    processedInvoice?.data;

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
                No pudimos completar la operación
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77736c]">
                {error}
              </p>

              {file && !processedInvoice && (
                <button
                  type="button"
                  onClick={handleProcessInvoice}
                  disabled={processing}
                  className="mt-7 rounded-2xl bg-[#1d1d1f] px-6 py-4 font-medium text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing
                    ? "Procesando..."
                    : "Intentar nuevamente"}
                </button>
              )}
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
          ) : processedInvoice ? (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f7f1] text-3xl">
                  ✓
                </div>

                <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                  Factura procesada
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#77736c]">
                  Crystal Reports identificó estos datos.
                  Revisalos antes de confirmar.
                </p>
              </div>

              <div className="mt-8 rounded-[24px] border border-[#eeeae4] bg-[#faf9f7] p-5">
                <div className="grid gap-5 sm:grid-cols-2">

                  <div>
                    <p className="text-xs text-[#aaa49a]">
                      Proveedor
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {invoiceData?.provider ??
                        "No identificado"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#aaa49a]">
                      Categoría
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {invoiceData?.category ??
                        "No identificada"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#aaa49a]">
                      Fecha de factura
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {invoiceData?.invoiceDate ??
                        "No identificada"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#aaa49a]">
                      Fecha de viaje
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {invoiceData?.tripDate ??
                        "No identificada"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#aaa49a]">
                      Monto
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {formatAmount(
                        invoiceData?.amount ?? null,
                        invoiceData?.currency ?? null,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#aaa49a]">
                      Número de factura
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {invoiceData?.invoiceNumber ??
                        "No identificado"}
                    </p>
                  </div>

                  {invoiceData?.origin && (
                    <div>
                      <p className="text-xs text-[#aaa49a]">
                        Origen
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {invoiceData.origin}
                      </p>
                    </div>
                  )}

                  {invoiceData?.destination && (
                    <div>
                      <p className="text-xs text-[#aaa49a]">
                        Destino
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {invoiceData.destination}
                      </p>
                    </div>
                  )}

                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-[#f8f5f0] p-5">
                <p className="text-sm font-medium text-[#55514a]">
                  ¿Todo está correcto?
                </p>

                <p className="mt-1 text-sm leading-6 text-[#77736c]">
                  Al confirmar, la factura quedará
                  registrada oficialmente en Crystal Reports.
                </p>
              </div>

              <button
                type="button"
                onClick={handleConfirmInvoice}
                disabled={confirming}
                className="mt-7 w-full rounded-2xl bg-[#1d1d1f] px-6 py-4 font-medium text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming
                  ? "Confirmando factura..."
                  : "Confirmar factura"}
              </button>

              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block text-center text-sm font-medium text-[#8f7957]"
                >
                  Ver factura original
                </a>
              )}
            </>
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

              <div className="mt-8 rounded-[24px] border border-[#eeeae4] bg-[#faf9f7] p-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm">
                  📄
                </div>

                <h2 className="mt-6 text-xl font-semibold">
                  Factura recibida
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#77736c]">
                  El documento llegó correctamente a
                  Crystal Reports.
                </p>

                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-7 block w-full rounded-2xl bg-white px-6 py-4 font-medium text-[#1d1d1f] ring-1 ring-[#e4e0d9] transition-all hover:bg-[#f6f3ee] active:scale-[0.98]"
                  >
                    Ver factura original
                  </a>
                )}
              </div>

              <div className="mt-6 rounded-2xl bg-[#f8f5f0] p-5">
                <p className="text-sm font-medium text-[#55514a]">
                  Lista para procesar
                </p>

                <p className="mt-1 text-sm leading-6 text-[#77736c]">
                  Al confirmar, Crystal Reports subirá
                  la factura y utilizará inteligencia
                  artificial para identificar sus datos.
                </p>
              </div>

              <button
                type="button"
                onClick={handleProcessInvoice}
                disabled={processing}
                className="mt-7 w-full rounded-2xl bg-[#1d1d1f] px-6 py-4 font-medium text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing
                  ? "Procesando factura..."
                  : "Confirmar y procesar factura"}
              </button>
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
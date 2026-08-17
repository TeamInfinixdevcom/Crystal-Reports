"use client";

import {useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {onAuthStateChanged} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {auth, db} from "../../../lib/firebase";
import {
  uploadInvoice,
  type ProcessedInvoice,
} from "../../../lib/invoices";

export default function NuevoViajePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [processedInvoices, setProcessedInvoices] =
    useState<ProcessedInvoice[]>([]);

  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [preview, setPreview] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleSelectFile = () => {
    if (!saving && !confirming) {
      fileInputRef.current?.click();
    }
  };

  const handleFilesSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    if (selectedFiles.length === 0) {
      return;
    }

    setFiles((currentFiles) => [
      ...currentFiles,
      ...selectedFiles,
    ]);

    event.target.value = "";
  };

  const handleRemoveFile = (
    index: number,
  ) => {
    if (saving || confirming) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.filter(
        (_, fileIndex) =>
          fileIndex !== index,
      ),
    );
  };

  /*
   * ==========================================
   * PROCESAR FACTURAS
   * ==========================================
   */

  const handleProcessInvoices = () => {
    if (
      files.length === 0 ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setProcessedInvoices([]);

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          unsubscribe();

          if (!user) {
            setError(
              "Tu sesión ha expirado. Iniciá sesión nuevamente.",
            );

            setSaving(false);

            return;
          }

          try {
            const results: ProcessedInvoice[] =
              [];

            for (
              const file of files
            ) {
              const result =
                await uploadInvoice(
                  user.uid,
                  null,
                  file,
                );

              results.push(result);

              setProcessedInvoices([
                ...results,
              ]);
            }

            /*
             * Mostramos la vista previa.
             */

            setPreview(true);

          } catch (error) {
            console.error(
              "ERROR AL PROCESAR FACTURAS:",
              error,
            );

            setError(
              "No pudimos procesar una de las facturas. Revisá el archivo e intentá nuevamente.",
            );

          } finally {
            setSaving(false);
          }
        },
      );
  };

  /*
   * ==========================================
   * CONFIRMAR FACTURAS
   * ==========================================
   */

  const handleConfirmInvoices = () => {
    if (
      processedInvoices.length ===
        0 ||
      confirming
    ) {
      return;
    }

    setConfirming(true);
    setError(null);

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          unsubscribe();

          if (!user) {
            setError(
              "Tu sesión ha expirado. Iniciá sesión nuevamente.",
            );

            setConfirming(false);

            return;
          }

          try {
            for (
              const invoice of
              processedInvoices
            ) {
              await updateDoc(
                doc(
                  db,
                  "users",
                  user.uid,
                  "invoices",
                  invoice.invoiceId,
                ),
                {
                  status:
                    "confirmed",

                  updatedAt:
                    serverTimestamp(),

                  processingError:
                    null,
                },
              );
            }

            router.push(
              "/viajes",
            );

          } catch (error) {
            console.error(
              "ERROR CONFIRMANDO FACTURAS:",
              error,
            );

            setError(
              "No pudimos confirmar las facturas. Intentá nuevamente.",
            );

            setConfirming(false);
          }
        },
      );
  };

  /*
   * ==========================================
   * VOLVER A SELECCIÓN
   * ==========================================
   */

  const handleBackToSelection =
    () => {
      if (
        saving ||
        confirming
      ) {
        return;
      }

      setPreview(false);
      setProcessedInvoices([]);
      setError(null);
    };

  /*
   * ==========================================
   * FORMATO DE MONTO
   * ==========================================
   */

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

    if (
      currency === "CRC"
    ) {
      return `₡${amount.toLocaleString(
        "es-CR",
      )}`;
    }

    return amount.toLocaleString(
      "es-CR",
    );
  };

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#1d1d1f]">

      <div className="mx-auto min-h-screen max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 xl:px-14 2xl:px-16">

        {/* HEADER */}

        <header className="flex items-center gap-4">

          <button
            onClick={() =>
              router.push(
                "/reportes",
              )
            }
            disabled={
              saving ||
              confirming
            }
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e0d9] bg-white text-lg text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Volver"
          >
            ←
          </button>

          <div>

            <p className="text-sm font-medium text-[#a18d6d]">
              Crystal Reports Cloud
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {preview
                ? "Revisar facturas"
                : "Agregar facturas"}
            </h1>

          </div>

        </header>

        <section className="mx-auto mt-12 max-w-3xl">

          <div className="rounded-[28px] border border-[#eeeae4] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-10">

            {!preview ? (
              <>
                {/* ==========================================
                    SELECCIÓN DE ARCHIVOS
                    ========================================== */}

                <div className="text-center">

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f1e9] text-3xl">
                    📄
                  </div>

                  <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                    Subí tus facturas
                  </h2>

                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#77736c]">
                    Subí una o varias facturas.
                    Crystal Reports identificará
                    automáticamente sus datos.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={
                    handleSelectFile
                  }
                  disabled={
                    saving ||
                    confirming
                  }
                  className="group mt-10 flex w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#dcd5ca] bg-[#faf9f7] px-6 py-12 text-center transition-all duration-150 hover:border-[#c8b99f] hover:bg-[#f8f5f0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                    📎
                  </div>

                  <h3 className="mt-5 text-lg font-semibold">
                    Agregar factura
                  </h3>

                  <p className="mt-2 text-sm text-[#77736c]">
                    Seleccioná una o varias facturas.
                  </p>

                  <p className="mt-2 text-xs text-[#aaa49a]">
                    PDF, JPG o PNG
                  </p>

                </button>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={
                    handleFilesSelected
                  }
                  className="hidden"
                />

                {/* ARCHIVOS SELECCIONADOS */}

                {files.length >
                  0 && (
                  <section className="mt-8">

                    <div className="flex items-center justify-between">

                      <h3 className="text-sm font-semibold text-[#55514a]">
                        Facturas seleccionadas
                      </h3>

                      <span className="text-xs text-[#8a857c]">
                        {files.length}{" "}
                        {files.length ===
                        1
                          ? "archivo"
                          : "archivos"}
                      </span>

                    </div>

                    <div className="mt-3 space-y-3">

                      {files.map(
                        (
                          file,
                          index,
                        ) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-[#eeeae4] bg-[#faf9f7] p-4"
                          >

                            <div className="flex min-w-0 items-center gap-4">

                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg">
                                📄
                              </div>

                              <div className="min-w-0">

                                <p className="truncate text-sm font-medium text-[#55514a]">
                                  {file.name}
                                </p>

                                <p className="mt-1 text-xs text-[#aaa49a]">
                                  {(
                                    file.size /
                                    1024 /
                                    1024
                                  ).toFixed(
                                    2,
                                  )}{" "}
                                  MB
                                </p>

                              </div>

                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveFile(
                                  index,
                                )
                              }
                              disabled={
                                saving ||
                                confirming
                              }
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm text-[#8a857c] transition-all hover:bg-[#eeeae4] hover:text-[#55514a] active:scale-90 disabled:opacity-40"
                              aria-label={`Eliminar ${file.name}`}
                            >
                              ×
                            </button>

                          </div>
                        ),
                      )}

                    </div>

                  </section>
                )}

                {/* INFORMACIÓN */}

                <div className="mt-6 rounded-2xl bg-[#f8f5f0] p-5">

                  <div className="flex gap-4">

                    <div className="text-lg">
                      ✨
                    </div>

                    <div>

                      <p className="text-sm font-medium text-[#55514a]">
                        Procesamiento automático
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#77736c]">
                        La inteligencia artificial
                        identificará proveedor,
                        fecha, monto, categoría y
                        demás información disponible.
                      </p>

                    </div>

                  </div>

                </div>

                {error && (
                  <div className="mt-6 rounded-2xl bg-[#fff4f2] p-4 text-sm text-[#9a5b50]">
                    {error}
                  </div>
                )}

                <div className="mt-8 flex justify-end">

                  <button
                    type="button"
                    onClick={
                      handleProcessInvoices
                    }
                    disabled={
                      files.length ===
                        0 ||
                      saving
                    }
                    className={`rounded-xl px-6 py-3 text-sm font-medium transition-all ${
                      files.length >
                        0 &&
                      !saving
                        ? "bg-[#1d1d1f] text-white hover:bg-[#333] active:scale-[0.97]"
                        : "cursor-not-allowed bg-[#e8e5df] text-[#aaa49a]"
                    }`}
                  >
                    {saving
                      ? "Procesando facturas..."
                      : "Revisar facturas"}
                  </button>

                </div>
              </>
            ) : (
              <>
                {/* ==========================================
                    VISTA PREVIA
                    ========================================== */}

                <div>

                  <div className="text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f7f1] text-3xl">
                      ✓
                    </div>

                    <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                      Revisá tus facturas
                    </h2>

                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#77736c]">
                      Crystal Reports identificó
                      estos datos. Revisalos antes
                      de confirmar.
                    </p>

                  </div>

                  <div className="mt-8 space-y-4">

                    {processedInvoices.map(
                      (
                        invoice,
                        index,
                      ) => {

                        const data =
                          invoice.data;

                        return (
                          <article
                            key={
                              invoice.invoiceId
                            }
                            className="rounded-[24px] border border-[#eeeae4] bg-[#faf9f7] p-5"
                          >

                            <div className="flex items-center justify-between gap-4">

                              <div className="flex items-center gap-3">

                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                                  📄
                                </div>

                                <div>

                                  <p className="text-sm font-semibold">
                                    Factura{" "}
                                    {index +
                                      1}
                                  </p>

                                  <p className="text-xs text-[#8a857c]">
                                    Datos detectados por IA
                                  </p>

                                </div>

                              </div>

                              <span className="rounded-full bg-[#f1f7f1] px-3 py-1 text-xs font-medium text-[#52705a]">
                                Lista
                              </span>

                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">

                              <div>
                                <p className="text-xs text-[#aaa49a]">
                                  Proveedor
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {data.provider ??
                                    "No identificado"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#aaa49a]">
                                  Categoría
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {data.category ??
                                    "No identificada"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#aaa49a]">
                                  Fecha de factura
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {data.invoiceDate ??
                                    "No identificada"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#aaa49a]">
                                  Fecha de viaje
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {data.tripDate ??
                                    "No identificada"}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#aaa49a]">
                                  Monto
                                </p>

                                <p className="mt-1 text-sm font-semibold">
                                  {formatAmount(
                                    data.amount,
                                    data.currency,
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#aaa49a]">
                                  Número de factura
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {data.invoiceNumber ??
                                    "No identificado"}
                                </p>
                              </div>

                              {data.origin && (
                                <div>
                                  <p className="text-xs text-[#aaa49a]">
                                    Origen
                                  </p>

                                  <p className="mt-1 text-sm font-medium">
                                    {data.origin}
                                  </p>
                                </div>
                              )}

                              {data.destination && (
                                <div>
                                  <p className="text-xs text-[#aaa49a]">
                                    Destino
                                  </p>

                                  <p className="mt-1 text-sm font-medium">
                                    {data.destination}
                                  </p>
                                </div>
                              )}

                            </div>

                          </article>
                        );
                      },
                    )}

                  </div>

                  <div className="mt-6 rounded-2xl bg-[#f8f5f0] p-5">

                    <p className="text-sm font-medium text-[#55514a]">
                      {processedInvoices.length}{" "}
                      {processedInvoices.length ===
                      1
                        ? "factura lista"
                        : "facturas listas"}{" "}
                      para confirmar
                    </p>

                    <p className="mt-1 text-sm leading-6 text-[#77736c]">
                      Una vez confirmadas, estas facturas
                      pasarán a formar parte de tus viajes
                      y del cálculo oficial de viáticos.
                    </p>

                  </div>

                  {error && (
                    <div className="mt-6 rounded-2xl bg-[#fff4f2] p-4 text-sm text-[#9a5b50]">
                      {error}
                    </div>
                  )}

                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                    <button
                      type="button"
                      onClick={
                        handleBackToSelection
                      }
                      disabled={
                        confirming
                      }
                      className="rounded-xl border border-[#e4e0d9] bg-white px-6 py-3 text-sm font-medium text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-[0.97] disabled:opacity-50"
                    >
                      Volver a revisar
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleConfirmInvoices
                      }
                      disabled={
                        processedInvoices.length ===
                          0 ||
                        confirming
                      }
                      className="rounded-xl bg-[#1d1d1f] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#333] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirming
                        ? "Confirmando..."
                        : `Confirmar ${
                            processedInvoices.length
                          } ${
                            processedInvoices.length ===
                            1
                              ? "factura"
                              : "facturas"
                          }`}
                    </button>

                  </div>

                </div>
              </>
            )}

          </div>

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
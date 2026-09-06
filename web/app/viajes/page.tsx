"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
} from "firebase/storage";

import {
  auth,
  db,
  storage,
} from "../../lib/firebase";

import { signOutUser } from "../../lib/auth";
import DesktopNav from "../../components/navigation/DesktopNav";
import MobileNav from "../../components/navigation/MobileNav";

type Invoice = {
  id: string;
  fileName?: string;
  storagePath?: string | null;
  provider?: string | null;
  category?: string | null;
  invoiceDate?: string | null;
  tripDate?: string | null;
  uploadedAt?: Timestamp | null;
  amount?: number | null;
  currency?: string | null;
  invoiceNumber?: string | null;
  status?: string | null;
};

function formatUploadedAt(
  value?: Timestamp | null,
) {
  if (!value) {
    return "—";
  }

  const date = value.toDate();

  return date.toLocaleString("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeProvider(
  provider?: string | null,
) {
  if (!provider) {
    return "otros";
  }

  const normalized =
    provider.trim().toLowerCase();

  if (normalized.includes("uber")) {
    return "uber";
  }

  if (
    normalized.includes("didi") ||
    normalized.includes("di di")
  ) {
    return "didi";
  }

  return "otros";
}

export default function ViajesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingInvoice, setOpeningInvoice] =
    useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] =
    useState<string | null>(null);

  const [providerFilter, setProviderFilter] =
    useState("all");

  const [dateFilter, setDateFilter] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const itemsPerPage = 10;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setInvoices([]);
          setLoading(false);
          return;
        }

        try {
          const invoicesRef = collection(
            db,
            "users",
            user.uid,
            "invoices",
          );

          const snapshot = await getDocs(
            invoicesRef,
          );

          const loadedInvoices: Invoice[] =
            snapshot.docs.map((invoiceDoc) => ({
              id: invoiceDoc.id,
              ...(invoiceDoc.data() as Omit<
                Invoice,
                "id"
              >),
            }));

          loadedInvoices.sort((a, b) => {
            const dateA =
              a.uploadedAt?.toMillis() ?? 0;

            const dateB =
              b.uploadedAt?.toMillis() ?? 0;

            return dateB - dateA;
          });

          setInvoices(loadedInvoices);
        } catch (error) {
          console.error(
            "ERROR CARGANDO FACTURAS:",
            error,
          );
        } finally {
          setLoading(false);
        }
      },
    );

    return unsubscribe;
  }, []);

  /*
   * ==========================================
   * FILTROS
   * ==========================================
   */

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      /*
       * Filtro por proveedor
       */

      if (
        providerFilter !== "all" &&
        normalizeProvider(invoice.provider) !==
          providerFilter
      ) {
        return false;
      }

      /*
       * Filtro por fecha
       *
       * Comparamos contra la fecha de factura.
       * Si no existe, usamos tripDate.
       */

      if (dateFilter) {
        const invoiceDate =
          invoice.invoiceDate ??
          invoice.tripDate;

        if (!invoiceDate) {
          return false;
        }

        const normalizedInvoiceDate =
          invoiceDate.slice(0, 10);

        if (
          normalizedInvoiceDate !==
          dateFilter
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    invoices,
    providerFilter,
    dateFilter,
  ]);

  /*
   * ==========================================
   * PAGINACIÓN
   * ==========================================
   */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredInvoices.length /
        itemsPerPage,
    ),
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages,
  );

  const startIndex =
    (safeCurrentPage - 1) *
    itemsPerPage;

  const endIndex = Math.min(
    startIndex + itemsPerPage,
    filteredInvoices.length,
  );

  const visibleInvoices =
    filteredInvoices.slice(
      startIndex,
      endIndex,
    );

  const clearFilters = () => {
    setProviderFilter("all");
    setDateFilter("");
    setCurrentPage(1);
  };

  const handleViewInvoice = async (
    invoice: Invoice,
  ) => {
    if (!invoice.storagePath) {
      alert(
        "Esta factura no tiene un archivo disponible.",
      );
      return;
    }

    try {
      setOpeningInvoice(invoice.id);

      const fileRef = ref(
        storage,
        invoice.storagePath,
      );

      const url =
        await getDownloadURL(fileRef);

      window.open(url, "_blank");
    } catch (error) {
      console.error(
        "ERROR ABRIENDO FACTURA:",
        error,
      );

      alert(
        "No pudimos abrir la factura.",
      );
    } finally {
      setOpeningInvoice(null);
    }
  };

  const handleDeleteInvoice = async (
    invoice: Invoice,
  ) => {
    const confirmed = window.confirm(
      `¿Eliminar la factura "${invoice.fileName ?? "Factura"}"?\n\nEsta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingInvoice(invoice.id);

      if (invoice.storagePath) {
        try {
          const fileRef = ref(
            storage,
            invoice.storagePath,
          );

          await deleteObject(fileRef);
        } catch (storageError) {
          console.error(
            "ERROR ELIMINANDO ARCHIVO:",
            storageError,
          );
        }
      }

      await deleteDoc(
        doc(
          db,
          "users",
          auth.currentUser?.uid ?? "",
          "invoices",
          invoice.id,
        ),
      );

      setInvoices(
        (currentInvoices) =>
          currentInvoices.filter(
            (item) =>
              item.id !== invoice.id,
          ),
      );
    } catch (error) {
      console.error(
        "ERROR ELIMINANDO FACTURA:",
        error,
      );

      alert(
        "No pudimos eliminar la factura.",
      );
    } finally {
      setDeletingInvoice(null);
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

          <DesktopNav active="viajes" />

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
            className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a]"
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
              Mis facturas
            </h1>

            <p className="mt-2 max-w-2xl text-[#77736c]">
              Consultá tu historial de facturas y los datos
              identificados automáticamente.
            </p>
          </section>

          {/* Cargando */}
          {loading && (
            <section className="mt-10 flex min-h-[300px] items-center justify-center rounded-[28px] border border-[#eeeae4] bg-white">
              <p className="text-sm text-[#8a857c]">
                Cargando facturas...
              </p>
            </section>
          )}

          {/* Sin facturas */}
          {!loading &&
            invoices.length === 0 && (
              <section className="mt-10 flex min-h-[360px] items-center justify-center rounded-[28px] border border-[#eeeae4] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                <div className="max-w-md px-6 text-center">

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f1e9] text-3xl">
                    📄
                  </div>

                  <h2 className="mt-6 text-xl font-semibold">
                    Aún no tenés facturas registradas
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#77736c]">
                    Subí una factura para que Crystal Reports
                    identifique automáticamente sus datos.
                  </p>

                </div>
              </section>
            )}

          {/* Historial */}
          {!loading &&
            invoices.length > 0 && (
              <section className="mt-10">

                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#eeeae4] bg-[#f6f3ee] px-4 py-3 text-sm text-[#77736c]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#a18d6d]">
                    i
                  </span>

                  <p>
                    La asociación de facturas con expedientes todavía no está disponible en los datos de esta pantalla.
                  </p>

                </div>

                {/* Filtros */}
                <div className="rounded-[24px] border border-[#eeeae4] bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.03)]">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">

                    {/* Fecha */}
                    <div className="flex-1">
                      <label
                        htmlFor="date-filter"
                        className="mb-2 block text-xs font-medium text-[#8a857c]"
                      >
                        Fecha
                      </label>

                      <input
                        id="date-filter"
                        type="date"
                        value={dateFilter}
                        onChange={(event) => {
                          setDateFilter(
                            event.target.value,
                          );
                          setCurrentPage(1);
                        }}
                        className="w-full rounded-xl border border-[#e4e0d9] bg-[#faf9f7] px-4 py-3 text-sm text-[#55514a] outline-none transition focus:border-[#c8b99f]"
                      />
                    </div>

                    {/* Proveedor */}
                    <div className="flex-1">
                      <label
                        htmlFor="provider-filter"
                        className="mb-2 block text-xs font-medium text-[#8a857c]"
                      >
                        Proveedor
                      </label>

                      <select
                        id="provider-filter"
                        value={
                          providerFilter
                        }
                        onChange={(event) => {
                          setProviderFilter(
                            event.target.value,
                          );
                          setCurrentPage(1);
                        }}
                        className="w-full rounded-xl border border-[#e4e0d9] bg-[#faf9f7] px-4 py-3 text-sm text-[#55514a] outline-none transition focus:border-[#c8b99f]"
                      >
                        <option value="all">
                          Todos
                        </option>

                        <option value="uber">
                          Uber
                        </option>

                        <option value="didi">
                          DiDi
                        </option>

                        <option value="otros">
                          Otros
                        </option>
                      </select>
                    </div>

                    {/* Limpiar */}
                    {(dateFilter ||
                      providerFilter !==
                        "all") && (
                      <button
                        type="button"
                        onClick={
                          clearFilters
                        }
                        className="rounded-xl border border-[#e4e0d9] bg-white px-5 py-3 text-sm font-medium text-[#55514a] transition hover:bg-[#f6f3ee] active:scale-[0.98]"
                      >
                        Limpiar filtros
                      </button>
                    )}

                  </div>

                  {/* Resultado */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#eeeae4] pt-4">

                    <p className="text-xs text-[#8a857c]">
                      {filteredInvoices.length ===
                      0
                        ? "Sin resultados"
                        : `${startIndex + 1}–${endIndex} de ${filteredInvoices.length} facturas`}
                    </p>

                    {(dateFilter ||
                      providerFilter !==
                        "all") && (
                      <p className="text-xs text-[#aaa49a]">
                        Filtros activos
                      </p>
                    )}

                  </div>

                </div>

                {/* Sin resultados */}
                {filteredInvoices.length ===
                  0 && (
                  <div className="mt-6 rounded-[24px] border border-[#eeeae4] bg-white p-10 text-center">
                    <div className="text-3xl">
                      🔎
                    </div>

                    <h2 className="mt-4 text-lg font-semibold">
                      No encontramos facturas
                    </h2>

                    <p className="mt-2 text-sm text-[#77736c]">
                      Probá cambiando la fecha o el proveedor.
                    </p>
                  </div>
                )}

                {/* Facturas */}
                {visibleInvoices.length >
                  0 && (
                  <div className="mt-6 space-y-4">

                    {visibleInvoices.map(
                      (invoice) => (
                        <article
                          key={invoice.id}
                          className="rounded-[24px] border border-[#eeeae4] bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.03)] sm:p-6"
                        >
                          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                            <div className="flex min-w-0 items-start gap-4">

                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f6f1e9] text-xl">
                                📄
                              </div>

                              <div className="min-w-0">
                                <h2 className="truncate text-base font-semibold">
                                  {invoice.fileName ??
                                    "Factura"}
                                </h2>

                                <p className="mt-1 text-sm text-[#77736c]">
                                  {invoice.provider ??
                                    "Proveedor pendiente"}
                                </p>
                              </div>

                            </div>

                            <span className="w-fit rounded-full bg-[#f6f1e9] px-3 py-1 text-xs font-medium text-[#8f7957]">
                              {invoice.status ??
                                "uploaded"}
                            </span>

                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#eeeae4] pt-5 sm:grid-cols-5">

                            {/* Fecha de factura */}
                            <div>
                              <p className="text-xs text-[#aaa49a]">
                                Fecha de factura
                              </p>

                              <p className="mt-1 text-sm font-medium">
                                {invoice.tripDate ??
                                  invoice.invoiceDate ??
                                  "—"}
                              </p>
                            </div>

                            {/* Fecha de subida */}
                            <div>
                              <p className="text-xs text-[#aaa49a]">
                                Subida al sistema
                              </p>

                              <p className="mt-1 text-sm font-medium">
                                {formatUploadedAt(
                                  invoice.uploadedAt,
                                )}
                              </p>
                            </div>

                            {/* Categoría */}
                            <div>
                              <p className="text-xs text-[#aaa49a]">
                                Categoría
                              </p>

                              <p className="mt-1 text-sm font-medium">
                                {invoice.category ??
                                  "—"}
                              </p>
                            </div>

                            {/* Referencia */}
                            <div>
                              <p className="text-xs text-[#aaa49a]">
                                Referencia
                              </p>

                              <p className="mt-1 text-sm font-medium">
                                {invoice.invoiceNumber ??
                                  "—"}
                              </p>
                            </div>

                            {/* Monto */}
                            <div>
                              <p className="text-xs text-[#aaa49a]">
                                Monto
                              </p>

                              <p className="mt-1 text-sm font-semibold">
                                {typeof invoice.amount ===
                                "number"
                                  ? `₡${invoice.amount.toLocaleString(
                                      "es-CR",
                                    )}`
                                  : "—"}
                              </p>
                            </div>

                          </div>

                          {/* Acciones */}
                          <div className="mt-5 flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                handleViewInvoice(
                                  invoice,
                                )
                              }
                              disabled={
                                openingInvoice ===
                                  invoice.id ||
                                deletingInvoice ===
                                  invoice.id
                              }
                              className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition hover:bg-[#f6f3ee] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {openingInvoice ===
                              invoice.id
                                ? "Abriendo..."
                                : "Ver factura"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteInvoice(
                                  invoice,
                                )
                              }
                              disabled={
                                deletingInvoice ===
                                  invoice.id ||
                                openingInvoice ===
                                  invoice.id
                              }
                              className="rounded-xl border border-[#ead7d2] bg-white px-4 py-2 text-sm font-medium text-[#9a5b50] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingInvoice ===
                              invoice.id
                                ? "Eliminando..."
                                : "Eliminar"}
                            </button>

                          </div>

                        </article>
                      ),
                    )}

                  </div>
                )}

                {/* Paginación */}
                {filteredInvoices.length >
                  itemsPerPage && (
                  <div className="mt-8 flex items-center justify-between rounded-[20px] border border-[#eeeae4] bg-white px-4 py-3">

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.max(
                              1,
                              page - 1,
                            ),
                        )
                      }
                      disabled={
                        safeCurrentPage === 1
                      }
                      className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition hover:bg-[#f6f3ee] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Anterior
                    </button>

                    <span className="text-xs text-[#8a857c]">
                      Página{" "}
                      {safeCurrentPage} de{" "}
                      {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.min(
                              totalPages,
                              page + 1,
                            ),
                        )
                      }
                      disabled={
                        safeCurrentPage ===
                        totalPages
                      }
                      className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition hover:bg-[#f6f3ee] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente →
                    </button>

                  </div>
                )}

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
        <MobileNav active="viajes" />

      </div>
    </main>
  );
}
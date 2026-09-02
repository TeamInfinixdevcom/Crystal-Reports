"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import { auth, db } from "../../lib/firebase";
import { signOutUser } from "../../lib/auth";
import DesktopNav from "../../components/navigation/DesktopNav";
import MobileNav from "../../components/navigation/MobileNav";

type Invoice = {
  id: string;
  fileName?: string;
  provider?: string | null;
  category?: string | null;
  invoiceDate?: string | null;
  tripDate?: string | null;
  amount?: number | null;
  storagePath?: string | null;
  fileType?: string | null;
  uploadedAt?: Timestamp | null;
};

type Report = {
  id: string;
  year?: number | null;
  month?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  invoiceCount?: number | null;
  totalAmount?: number | null;
  pageCount?: number | null;
  storagePath?: string | null;
  generatedAt?: Timestamp | null;
};

type MonthlyReportResponse = {
  success: boolean;
  year: number;
  month: number;
  invoiceCount: number;
  pageCount: number;
  storagePath: string;
  url: string;
};

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatInvoiceDate(
  value?: string | null,
) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatUploadedAt(
  value?: Timestamp | null,
) {
  if (!value) {
    return "Sin fecha de subida";
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

function formatGeneratedAt(
  value?: Timestamp | null,
) {
  if (!value) {
    return "Sin fecha";
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

export default function ReportesPage() {
  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [reports, setReports] =
    useState<Report[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [openingReport, setOpeningReport] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] =
    useState(() => {
      const now = new Date();

      return `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}`;
    });

  /*
   * ==========================================
   * RANGO DE FECHAS (NUEVA FUNCIONALIDAD)
   * ==========================================
   */

  const [rangeStartDate, setRangeStartDate] =
    useState("");

  const [rangeEndDate, setRangeEndDate] =
    useState("");

  const [rangeMode, setRangeMode] =
    useState(false);

  const [viajesToday, setViajesToday] =
    useState<Invoice[]>([]);

  /*
   * ==========================================
   * FILTRO DEL HISTORIAL
   * ==========================================
   */

  const [reportDateFilter, setReportDateFilter] =
    useState("");

  /*
   * ==========================================
   * PAGINACIÓN
   * ==========================================
   */

  const [currentPage, setCurrentPage] =
    useState(1);

  const itemsPerPage = 10;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setInvoices([]);
          setReports([]);
          setLoading(false);
          return;
        }

        try {
          /*
           * ==========================================
           * FACTURAS
           * ==========================================
           */

          const invoicesRef = collection(
            db,
            "users",
            user.uid,
            "invoices",
          );

          const invoicesSnapshot =
            await getDocs(invoicesRef);

          const loadedInvoices: Invoice[] =
            invoicesSnapshot.docs.map(
              (invoiceDoc) => ({
                id: invoiceDoc.id,
                ...(invoiceDoc.data() as Omit<
                  Invoice,
                  "id"
                >),
              }),
            );

          setInvoices(
            loadedInvoices,
          );

          /*
           * ==========================================
           * EXPEDIENTES GENERADOS
           * ==========================================
           *
           * Cada PDF generado por
           * generateMonthlyReport crea un
           * documento independiente en:
           *
           * users/{uid}/reports/{reportId}
           */

          const reportsRef = collection(
            db,
            "users",
            user.uid,
            "reports",
          );

          const reportsSnapshot =
            await getDocs(reportsRef);

          const loadedReports: Report[] =
            reportsSnapshot.docs.map(
              (reportDoc) => ({
                id: reportDoc.id,
                ...(reportDoc.data() as Omit<
                  Report,
                  "id"
                >),
              }),
            );

          loadedReports.sort((a, b) => {
            const dateA =
              a.generatedAt?.toMillis() ?? 0;

            const dateB =
              b.generatedAt?.toMillis() ?? 0;

            return dateB - dateA;
          });

          setReports(
            loadedReports,
          );
        } catch (err) {
          console.error(
            "ERROR CARGANDO REPORTES:",
            err,
          );

          setError(
            "No pudimos cargar los reportes.",
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
   * DATOS MENSUALES
   * ==========================================
   *
   * El mes del reporte se determina por
   * uploadedAt de las facturas.
   */

  const monthlyData = useMemo(() => {
    const now = new Date();

    return Array.from(
      { length: 12 },
      (_, index) => {
        const date = new Date(
          now.getFullYear(),
          now.getMonth() -
            (11 - index),
          1,
        );

        const year =
          date.getFullYear();

        const month =
          date.getMonth() + 1;

        const key = `${year}-${String(
          month,
        ).padStart(2, "0")}`;

        const monthInvoices =
          invoices.filter(
            (invoice) => {
              if (!invoice.uploadedAt) {
                return false;
              }

              const uploadedDate =
                invoice.uploadedAt.toDate();

              return (
                uploadedDate.getFullYear() ===
                  year &&
                uploadedDate.getMonth() + 1 ===
                  month
              );
            },
          );

        const amount =
          monthInvoices.reduce(
            (total, invoice) =>
              total +
              (typeof invoice.amount ===
              "number"
                ? invoice.amount
                : 0),
            0,
          );

        return {
          key,
          label: `${MONTHS[month - 1]} ${year}`,
          shortLabel:
            MONTHS[month - 1].slice(
              0,
              3,
            ),
          amount,
          documents:
            monthInvoices.length,
        };
      },
    );
  }, [invoices]);

  /*
   * ==========================================
   * FACTURAS DEL PERÍODO SELECCIONADO
   * ==========================================
   */

  const selectedInvoices =
    useMemo(() => {
      if (rangeMode) {
        /*
         * Modo rango: filtrar por tripDate
         */

        if (
          !rangeStartDate ||
          !rangeEndDate
        ) {
          return [];
        }

        return invoices.filter(
          (invoice) => {
            if (!invoice.tripDate) {
              return false;
            }

            return (
              invoice.tripDate >=
                rangeStartDate &&
              invoice.tripDate <=
                rangeEndDate
            );
          },
        );
      }

      /*
       * Modo mes: filtrar por uploadedAt
       */

      return invoices.filter(
        (invoice) => {
          if (!invoice.uploadedAt) {
            return false;
          }

          const uploadedDate =
            invoice.uploadedAt.toDate();

          const key = `${uploadedDate.getFullYear()}-${String(
            uploadedDate.getMonth() + 1,
          ).padStart(2, "0")}`;

          return key === selectedMonth;
        },
      );
    }, [
      invoices,
      selectedMonth,
      rangeMode,
      rangeStartDate,
      rangeEndDate,
    ]);

  /*
   * ==========================================
   * TOTAL DEL PERÍODO
   * ==========================================
   */

  const selectedTotal =
    selectedInvoices.reduce(
      (total, invoice) =>
        total +
        (typeof invoice.amount ===
        "number"
          ? invoice.amount
          : 0),
      0,
    );

  const maxAmount = Math.max(
    ...monthlyData.map(
      (month) => month.amount,
    ),
    1,
  );

  /*
   * ==========================================
   * FILTRAR HISTORIAL DE EXPEDIENTES
   * ==========================================
   *
   * El filtro es por fecha de generación.
   */

  const filteredReports =
    useMemo(() => {
      if (!reportDateFilter) {
        return reports;
      }

      return reports.filter(
        (report) => {
          if (!report.generatedAt) {
            return false;
          }

          const generatedDate =
            report.generatedAt.toDate();

          const year =
            generatedDate.getFullYear();

          const month = String(
            generatedDate.getMonth() + 1,
          ).padStart(2, "0");

          const day = String(
            generatedDate.getDate(),
          ).padStart(2, "0");

          const generatedKey =
            `${year}-${month}-${day}`;

          return (
            generatedKey ===
            reportDateFilter
          );
        },
      );
    }, [
      reports,
      reportDateFilter,
    ]);

  /*
   * ==========================================
   * PAGINACIÓN DE EXPEDIENTES
   * ==========================================
   */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredReports.length /
          itemsPerPage,
      ),
    );

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages,
    );

  const startIndex =
    (safeCurrentPage - 1) *
    itemsPerPage;

  const endIndex =
    Math.min(
      startIndex +
        itemsPerPage,
      filteredReports.length,
    );

  const visibleReports =
    filteredReports.slice(
      startIndex,
      endIndex,
    );

  useEffect(() => {
    setCurrentPage(1);
  }, [reportDateFilter]);

  /*
   * ==========================================
   * GENERAR EXPEDIENTE
   * ==========================================
   */

  const handleGenerateReport =
    async () => {
      if (generating) {
        return;
      }

      setGenerating(true);
      setError(null);

      try {
        const functions =
          getFunctions(auth.app);

        if (rangeMode) {
          /*
           * ==========================================
           * MODO RANGO
           * ==========================================
           */

          const generateRangeReport =
            httpsCallable<
              {
                startDate: string;
                endDate: string;
              },
              {
                success: boolean;
                startDate: string;
                endDate: string;
                invoiceCount: number;
                pageCount: number;
                storagePath: string;
                url: string;
              }
            >(
              functions,
              "generateRangeReport",
            );

          const result =
            await generateRangeReport({
              startDate:
                rangeStartDate,
              endDate:
                rangeEndDate,
            });

          const data =
            result.data;

          if (
            !data.success ||
            !data.url
          ) {
            throw new Error(
              "No se pudo generar el expediente.",
            );
          }

          window.open(
            data.url,
            "_blank",
            "noopener,noreferrer",
          );
        } else {
          /*
           * ==========================================
           * MODO MES
           * ==========================================
           */

          const [
            yearString,
            monthString,
          ] = selectedMonth.split(
            "-",
          );

          const year =
            Number(yearString);

          const month =
            Number(monthString);

          const generateMonthlyReport =
            httpsCallable<
              {
                year: number;
                month: number;
              },
              {
                success: boolean;
                year: number;
                month: number;
                invoiceCount: number;
                pageCount: number;
                storagePath: string;
                url: string;
              }
            >(
              functions,
              "generateMonthlyReport",
            );

          const result =
            await generateMonthlyReport({
              year,
              month,
            });

          const data =
            result.data;

          if (
            !data.success ||
            !data.url
          ) {
            throw new Error(
              "No se pudo generar el expediente.",
            );
          }

          window.open(
            data.url,
            "_blank",
            "noopener,noreferrer",
          );
        }

        /*
         * Recargar reportes
         */

        const user =
          auth.currentUser;

        if (user) {
          const reportsRef =
            collection(
              db,
              "users",
              user.uid,
              "reports",
            );

          const reportsSnapshot =
            await getDocs(
              reportsRef,
            );

          const updatedReports: Report[] =
            reportsSnapshot.docs
              .map(
                (reportDoc) => ({
                  id: reportDoc.id,
                  ...(reportDoc.data() as Omit<
                    Report,
                    "id"
                  >),
                }),
              )
              .sort(
                (a, b) => {
                  const dateA =
                    a.generatedAt?.toMillis() ??
                    0;

                  const dateB =
                    b.generatedAt?.toMillis() ??
                    0;

                  return (
                    dateB - dateA
                  );
                },
              );

          setReports(
            updatedReports,
          );
        }
      } catch (err) {
        console.error(
          "ERROR GENERANDO EXPEDIENTE:",
          err,
        );

        const errorMsg =
          err instanceof Error
            ? err.message
            : "No pudimos generar el expediente.";

        setError(errorMsg);
      } finally {
        setGenerating(false);
      }
    };

  /*
   * ==========================================
   * ABRIR EXPEDIENTE
   * ==========================================
   */

  const handleOpenReport =
    async (report: Report) => {
      if (!report.storagePath) {
        setError(
          "Este expediente no tiene un archivo disponible.",
        );

        return;
      }

      try {
        setOpeningReport(
          report.id,
        );

        const functions =
          getFunctions(auth.app);

        const getReportUrl =
          httpsCallable<
            {
              storagePath: string;
            },
            {
              success: boolean;
              url: string;
            }
          >(
            functions,
            "getReportUrl",
          );

        const result =
          await getReportUrl({
            storagePath:
              report.storagePath,
          });

        if (
          !result.data.success ||
          !result.data.url
        ) {
          throw new Error(
            "No se pudo obtener la URL del expediente.",
          );
        }

        window.open(
          result.data.url,
          "_blank",
          "noopener,noreferrer",
        );
      } catch (err) {
        console.error(
          "ERROR ABRIENDO EXPEDIENTE:",
          err,
        );

        setError(
          "No pudimos abrir este expediente.",
        );
      } finally {
        setOpeningReport(
          null,
        );
      }
    };

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#1d1d1f]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col">

        {/* Desktop */}
        <header className="hidden items-center justify-between border-b border-[#eeeae4] bg-white/80 px-8 py-5 backdrop-blur-md lg:flex">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6f1e9] text-lg">
              ◇
            </div>

            <span className="font-semibold tracking-tight">
              Crystal Reports Cloud
            </span>
          </div>

          <DesktopNav active="reportes" />

          <button
            onClick={signOutUser}
            className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition hover:bg-[#f6f3ee]"
          >
            Salir
          </button>

        </header>

        {/* Mobile */}
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

            <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Reportes
                </h1>

                <p className="mt-2 text-[#77736c]">
                  Analizá tus viáticos y prepará tu expediente.
                </p>

              </div>

              {!rangeMode && (
                <select
                  value={selectedMonth}
                  onChange={(event) =>
                    setSelectedMonth(
                      event.target.value,
                    )
                  }
                  className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-3 text-sm font-medium outline-none"
                >

                  {monthlyData
                    .slice()
                    .reverse()
                    .map(
                      (month) => (
                        <option
                          key={
                            month.key
                          }
                          value={
                            month.key
                          }
                        >
                          {
                            month.label
                          }
                        </option>
                      ),
                    )}

                </select>
              )}

            </div>

            {/* Toggle Modo */}
            <div className="mt-6 flex gap-2">

              <button
                type="button"
                onClick={() => {
                  setRangeMode(false);
                  setRangeStartDate("");
                  setRangeEndDate("");
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  !rangeMode
                    ? "bg-[#1d1d1f] text-white"
                    : "border border-[#e4e0d9] bg-white text-[#55514a] hover:bg-[#f6f3ee]"
                }`}
              >
                Por mes
              </button>

              <button
                type="button"
                onClick={() => {
                  setRangeMode(true);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  rangeMode
                    ? "bg-[#1d1d1f] text-white"
                    : "border border-[#e4e0d9] bg-white text-[#55514a] hover:bg-[#f6f3ee]"
                }`}
              >
                Por rango
              </button>

            </div>

          </section>

          {error && (
            <div className="mt-6 rounded-2xl bg-[#fff4f2] p-4 text-sm text-[#9a5b50]">
              {error}
            </div>
          )}

          {/* Selector de Rango (Modo Rango) */}
          {rangeMode && (
            <div className="mt-6 rounded-[28px] border border-[#eeeae4] bg-white p-6">

              <h2 className="text-lg font-semibold">
                Seleccionar rango de fechas
              </h2>

              <p className="mt-1 text-sm text-[#8a857c]">
                El expediente incluirá los viajes realizados dentro de este rango.
              </p>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">

                <div className="flex-1">

                  <label
                    htmlFor="range-start"
                    className="mb-2 block text-xs font-medium text-[#8a857c]"
                  >
                    Desde
                  </label>

                  <input
                    id="range-start"
                    type="date"
                    value={rangeStartDate}
                    onChange={(e) =>
                      setRangeStartDate(
                        e.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-[#e4e0d9] bg-white px-4 py-3 text-sm text-[#55514a] outline-none transition focus:border-[#c8b99f]"
                  />

                </div>

                <div className="flex-1">

                  <label
                    htmlFor="range-end"
                    className="mb-2 block text-xs font-medium text-[#8a857c]"
                  >
                    Hasta
                  </label>

                  <input
                    id="range-end"
                    type="date"
                    value={rangeEndDate}
                    onChange={(e) =>
                      setRangeEndDate(
                        e.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-[#e4e0d9] bg-white px-4 py-3 text-sm text-[#55514a] outline-none transition focus:border-[#c8b99f]"
                  />

                </div>

              </div>

            </div>
          )}

          {loading ? (
            <section className="mt-10 flex min-h-[300px] items-center justify-center rounded-[28px] border border-[#eeeae4] bg-white">

              <p className="text-sm text-[#8a857c]">
                Cargando reportes...
              </p>

            </section>
          ) : (
            <>

              {/* =====================================
                  RESUMEN (MODO MES)
                  ===================================== */}

              {!rangeMode && (
                <section className="mt-10 grid gap-4 sm:grid-cols-3">

                  <div className="rounded-[24px] border border-[#eeeae4] bg-white p-6">

                    <p className="text-sm text-[#8a857c]">
                      Viáticos del mes
                    </p>

                    <p className="mt-3 text-3xl font-semibold">
                      ₡
                      {selectedTotal.toLocaleString(
                        "es-CR",
                      )}
                    </p>

                  </div>

                  <div className="rounded-[24px] border border-[#eeeae4] bg-white p-6">

                    <p className="text-sm text-[#8a857c]">
                      Facturas
                    </p>

                    <p className="mt-3 text-3xl font-semibold">
                      {
                        selectedInvoices.length
                      }
                    </p>

                    <p className="mt-1 text-xs text-[#aaa49a]">
                      Del período seleccionado
                    </p>

                  </div>

                  <div className="rounded-[24px] bg-[#1d1d1f] p-6 text-white">

                    <p className="text-sm text-white/60">
                      Expediente mensual
                    </p>

                    <button
                      onClick={
                        handleGenerateReport
                      }
                      disabled={
                        generating ||
                        selectedInvoices.length ===
                          0
                      }
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f1eee9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generating
                        ? "Generando PDF..."
                        : "Generar expediente PDF"}
                    </button>

                  </div>

                </section>
              )}

              {/* =====================================
                  RESUMEN (MODO RANGO)
                  ===================================== */}

              {rangeMode && (
                <section className="mt-10 rounded-[28px] bg-[#1d1d1f] p-6 text-white">

                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

                    <div>

                      <p className="text-sm text-white/60">
                        Viajes encontrados
                      </p>

                      <p className="mt-2 text-3xl font-semibold">
                        {
                          selectedInvoices.length
                        }
                      </p>

                      {selectedInvoices.length >
                        0 && (
                        <p className="mt-2 text-sm text-white/80">
                          Total: ₡
                          {selectedTotal.toLocaleString(
                            "es-CR",
                          )}
                        </p>
                      )}

                    </div>

                    <button
                      onClick={
                        handleGenerateReport
                      }
                      disabled={
                        generating ||
                        selectedInvoices.length ===
                          0 ||
                        !rangeStartDate ||
                        !rangeEndDate
                      }
                      className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f1eee9] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      {generating
                        ? "Generando PDF..."
                        : "Generar expediente PDF"}
                    </button>

                  </div>

                </section>
              )}

              {/* =====================================
                  GRÁFICA (SOLO MODO MES)
                  ===================================== */}

              {!rangeMode && (
                <section className="mt-6 rounded-[28px] border border-[#eeeae4] bg-white p-6 sm:p-8">

                <h2 className="text-lg font-semibold">
                  Viáticos por mes
                </h2>

                <p className="mt-1 text-sm text-[#8a857c]">
                  Últimos 12 meses
                </p>

                <div className="mt-8 flex h-64 items-end gap-2 sm:gap-4">

                  {monthlyData.map(
                    (month) => {
                      const height =
                        month.amount ===
                        0
                          ? 4
                          : Math.max(
                              (month.amount /
                                maxAmount) *
                                100,
                              8,
                            );

                      const active =
                        month.key ===
                        selectedMonth;

                      return (
                        <button
                          key={
                            month.key
                          }
                          type="button"
                          onClick={() =>
                            setSelectedMonth(
                              month.key,
                            )
                          }
                          className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                        >

                          <div className="flex flex-1 items-end justify-center">

                            <div
                              className={`w-full max-w-12 rounded-t-xl transition ${
                                active
                                  ? "bg-[#1d1d1f]"
                                  : "bg-[#e5ddd1] group-hover:bg-[#cfc1ad]"
                              }`}
                              style={{
                                height: `${height}%`,
                              }}
                            />

                          </div>

                          <p className="mt-3 truncate text-[10px] font-medium text-[#8a857c] sm:text-xs">
                            {
                              month.shortLabel
                            }
                          </p>

                        </button>
                      );
                    },
                  )}

                </div>

              </section>
              )}

              {/* =====================================
                  MOSTRAR ESTADO RANGO
                  ===================================== */}

              {rangeMode && selectedInvoices.length === 0 && rangeStartDate && rangeEndDate && (
                <section className="mt-6 rounded-[24px] border border-[#eeeae4] bg-white p-10 text-center">

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f6f1e9] text-2xl">
                    📄
                  </div>

                  <h3 className="mt-4 font-semibold">
                    No hay viajes realizados en este rango
                  </h3>

                  <p className="mt-2 text-sm text-[#77736c]">
                    Selecciona un rango diferente para encontrar viajes.
                  </p>

                </section>
              )}

              {!rangeMode && (
                <section className="mt-6">

                <h2 className="text-lg font-semibold">
                  Facturas del período
                </h2>

                <p className="mt-1 text-sm text-[#8a857c]">
                  {
                    selectedInvoices.length
                  }{" "}
                  documento(s) · ₡
                  {selectedTotal.toLocaleString(
                    "es-CR",
                  )}
                </p>

                {selectedInvoices.length ===
                0 ? (
                  <div className="mt-4 rounded-[24px] border border-[#eeeae4] bg-white p-10 text-center">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f6f1e9] text-2xl">
                      📄
                    </div>

                    <h3 className="mt-4 font-semibold">
                      No hay facturas este mes
                    </h3>

                  </div>
                ) : (
                  <div className="mt-4 space-y-3">

                    {selectedInvoices.map(
                      (invoice) => (
                        <div
                          key={
                            invoice.id
                          }
                          className="rounded-[22px] border border-[#eeeae4] bg-white p-5"
                        >

                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                            <div className="min-w-0">

                              <p className="truncate text-sm font-semibold">
                                {
                                  invoice.provider ??
                                  invoice.fileName ??
                                  "Factura"
                                }
                              </p>

                              <div className="mt-2 space-y-1 text-xs text-[#8a857c]">

                                <p>
                                  <span className="font-medium text-[#55514a]">
                                    Fecha de factura:
                                  </span>{" "}
                                  {formatInvoiceDate(
                                    invoice.tripDate ??
                                      invoice.invoiceDate,
                                  )}
                                </p>

                                <p>
                                  <span className="font-medium text-[#55514a]">
                                    Subida al sistema:
                                  </span>{" "}
                                  {formatUploadedAt(
                                    invoice.uploadedAt,
                                  )}
                                </p>

                                <p>
                                  <span className="font-medium text-[#55514a]">
                                    Categoría:
                                  </span>{" "}
                                  {invoice.category ??
                                    "Sin categoría"}
                                </p>

                              </div>

                            </div>

                            <p className="shrink-0 text-sm font-semibold">
                              {typeof invoice.amount ===
                              "number"
                                ? `₡${invoice.amount.toLocaleString(
                                    "es-CR",
                                  )}`
                                : "—"}
                            </p>

                          </div>

                        </div>
                      ),
                    )}

                  </div>
                )}

              </section>
              )}

              {/* =====================================
                  HISTORIAL DE EXPEDIENTES
                  ===================================== */}

              <section className="mt-10">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                  <div>

                    <h2 className="text-lg font-semibold">
                      Historial de expedientes
                    </h2>

                    <p className="mt-1 text-sm text-[#8a857c]">
                      Cada PDF generado queda guardado
                      independientemente.
                    </p>

                  </div>

                  {/* Filtro por fecha */}
                  <div>

                    <label
                      htmlFor="report-date-filter"
                      className="mb-2 block text-xs font-medium text-[#8a857c]"
                    >
                      Fecha de generación
                    </label>

                    <input
                      id="report-date-filter"
                      type="date"
                      value={
                        reportDateFilter
                      }
                      onChange={(
                        event,
                      ) =>
                        setReportDateFilter(
                          event.target.value,
                        )
                      }
                      className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-3 text-sm text-[#55514a] outline-none transition focus:border-[#c8b99f]"
                    />

                  </div>

                </div>

                {filteredReports.length ===
                0 ? (
                  <div className="mt-5 rounded-[24px] border border-[#eeeae4] bg-white p-10 text-center">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f6f1e9] text-2xl">
                      📁
                    </div>

                    <h3 className="mt-4 font-semibold">
                      No hay expedientes registrados
                    </h3>

                    <p className="mt-2 text-sm text-[#77736c]">
                      Los PDFs que generés aparecerán aquí.
                    </p>

                  </div>
                ) : (
                  <>

                    <div className="mt-5 space-y-3">

                      {visibleReports.map(
                        (report) => (
                          <article
                            key={
                              report.id
                            }
                            className="rounded-[24px] border border-[#eeeae4] bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.03)]"
                          >

                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                              <div className="flex min-w-0 items-start gap-4">

                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f6f1e9] text-xl">
                                  📄
                                </div>

                                <div className="min-w-0">

                                  <h3 className="font-semibold">
                                    {report.year &&
                                    report.month
                                      ? `Expediente ${report.year}-${String(
                                          report.month,
                                        ).padStart(
                                          2,
                                          "0",
                                        )}`
                                      : report.startDate &&
                                          report.endDate
                                        ? `Expediente ${report.startDate} a ${report.endDate}`
                                        : "Expediente"}
                                  </h3>

                                  <p className="mt-1 text-sm text-[#77736c]">
                                    Generado:{" "}
                                    {formatGeneratedAt(
                                      report.generatedAt,
                                    )}
                                  </p>

                                </div>

                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenReport(
                                    report,
                                  )
                                }
                                disabled={
                                  openingReport ===
                                  report.id
                                }
                                className="shrink-0 rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {openingReport ===
                                report.id
                                  ? "Abriendo..."
                                  : "Ver PDF"}
                              </button>

                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#eeeae4] pt-4 sm:grid-cols-3">

                              <div>

                                <p className="text-xs text-[#aaa49a]">
                                  Facturas
                                </p>

                                <p className="mt-1 text-sm font-semibold">
                                  {report.invoiceCount ??
                                    0}
                                </p>

                              </div>

                              <div>

                                <p className="text-xs text-[#aaa49a]">
                                  Total
                                </p>

                                <p className="mt-1 text-sm font-semibold">
                                  ₡
                                  {(
                                    report.totalAmount ??
                                    0
                                  ).toLocaleString(
                                    "es-CR",
                                  )}
                                </p>

                              </div>

                              <div>

                                <p className="text-xs text-[#aaa49a]">
                                  Páginas
                                </p>

                                <p className="mt-1 text-sm font-semibold">
                                  {report.pageCount ??
                                    0}
                                </p>

                              </div>

                            </div>

                          </article>
                        ),
                      )}

                    </div>

                    {/* Paginación */}
                    {filteredReports.length >
                      itemsPerPage && (
                      <div className="mt-6 flex items-center justify-between rounded-[20px] border border-[#eeeae4] bg-white px-4 py-3">

                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPage(
                              (page) =>
                                Math.max(
                                  1,
                                  page -
                                    1,
                                ),
                            )
                          }
                          disabled={
                            safeCurrentPage ===
                            1
                          }
                          className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2 text-sm font-medium text-[#55514a] transition hover:bg-[#f6f3ee] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ← Anterior
                        </button>

                        <span className="text-xs text-[#8a857c]">
                          {startIndex +
                            1}
                          –
                          {endIndex}{" "}
                          de{" "}
                          {
                            filteredReports.length
                          }{" "}
                          expedientes
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPage(
                              (page) =>
                                Math.min(
                                  totalPages,
                                  page +
                                    1,
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

                  </>
                )}

              </section>

            </>
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

        <MobileNav active="reportes" />

      </div>
    </main>
  );
}
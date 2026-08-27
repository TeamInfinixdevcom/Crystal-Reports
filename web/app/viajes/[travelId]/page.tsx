"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../../../lib/firebase";

type TravelPageProps = {
  params: Promise<{
    travelId: string;
  }>;
};

type InvoiceItem = {
  id: string;

  fileName: string;
  fileType: string;
  fileSize: number;

  status: string;

  uploadedAt: unknown;

  provider: string | null;
  category: string | null;

  invoiceDate: string | null;
  tripDate: string | null;
  tripTime: string | null;

  amount: number | null;
  currency: "CRC" | null;

  invoiceNumber: string | null;

  origin: string | null;
  destination: string | null;

  service: string | null;
  distance: number | null;
  duration: number | null;

  paymentMethod: string | null;

  processingError: string | null;
};

type InvoiceEditForm = {
  provider: string;
  category: string;
  invoiceDate: string;
  tripDate: string;
  tripTime: string;
  amount: string;
  invoiceNumber: string;
  origin: string;
  destination: string;
  service: string;
  distance: string;
  duration: string;
  paymentMethod: string;
};

const emptyEditForm: InvoiceEditForm = {
  provider: "",
  category: "",
  invoiceDate: "",
  tripDate: "",
  tripTime: "",
  amount: "",
  invoiceNumber: "",
  origin: "",
  destination: "",
  service: "",
  distance: "",
  duration: "",
  paymentMethod: "",
};

export default function TravelPage({
  params,
}: TravelPageProps) {
  const router = useRouter();

  const [travelId, setTravelId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingInvoiceId, setEditingInvoiceId] =
    useState<string | null>(null);

  const [editForm, setEditForm] =
    useState<InvoiceEditForm>(emptyEditForm);

  const [savingInvoiceId, setSavingInvoiceId] =
    useState<string | null>(null);

  const [confirmingInvoiceId, setConfirmingInvoiceId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const loadTravel = async () => {
      try {
        const resolvedParams = await params;
        const currentTravelId = resolvedParams.travelId;

        setTravelId(currentTravelId);

        unsubscribeAuth = onAuthStateChanged(
          auth,
          async (user) => {
            if (!user) {
              router.push("/");
              return;
            }

            try {
              const invoicesRef = collection(
                db,
                "users",
                user.uid,
                "travels",
                currentTravelId,
                "invoices",
              );

              const invoicesQuery = query(
                invoicesRef,
                orderBy("uploadedAt", "desc"),
              );

              const snapshot = await getDocs(invoicesQuery);

              const loadedInvoices: InvoiceItem[] =
                snapshot.docs.map((docSnapshot) => {
                  const data = docSnapshot.data();

                  return {
                    id: docSnapshot.id,

                    fileName: data.fileName ?? "",
                    fileType: data.fileType ?? "",
                    fileSize: data.fileSize ?? 0,

                    status: data.status ?? "uploaded",

                    uploadedAt: data.uploadedAt ?? null,

                    provider: data.provider ?? null,
                    category: data.category ?? null,

                    invoiceDate: data.invoiceDate ?? null,
                    tripDate: data.tripDate ?? null,
                    tripTime: data.tripTime ?? null,

                    amount:
                      typeof data.amount === "number"
                        ? data.amount
                        : null,

                    currency:
                      data.currency === "CRC"
                        ? "CRC"
                        : null,

                    invoiceNumber:
                      data.invoiceNumber ?? null,

                    origin: data.origin ?? null,
                    destination: data.destination ?? null,

                    service: data.service ?? null,

                    distance:
                      typeof data.distance === "number"
                        ? data.distance
                        : null,

                    duration:
                      typeof data.duration === "number"
                        ? data.duration
                        : null,

                    paymentMethod:
                      data.paymentMethod ?? null,

                    processingError:
                      data.processingError ?? null,
                  };
                });

              setInvoices(loadedInvoices);
            } catch (firebaseError) {
              console.error(
                "ERROR LOADING TRAVEL:",
                firebaseError,
              );

              setError(
                "No pudimos cargar las facturas del viaje.",
              );
            } finally {
              setLoading(false);
            }
          },
        );
      } catch (pageError) {
        console.error(
          "ERROR LOADING PAGE:",
          pageError,
        );

        setError("No pudimos cargar el viaje.");
        setLoading(false);
      }
    };

    loadTravel();

    return () => {
      unsubscribeAuth?.();
    };
  }, [params, router]);

  const startEditingInvoice = (
    invoice: InvoiceItem,
  ) => {
    setError(null);

    setEditingInvoiceId(invoice.id);

    setEditForm({
      provider: invoice.provider ?? "",
      category: invoice.category ?? "",
      invoiceDate: invoice.invoiceDate ?? "",
      tripDate: invoice.tripDate ?? "",
      tripTime: invoice.tripTime ?? "",
      amount:
        invoice.amount !== null
          ? String(invoice.amount)
          : "",
      invoiceNumber:
        invoice.invoiceNumber ?? "",
      origin: invoice.origin ?? "",
      destination: invoice.destination ?? "",
      service: invoice.service ?? "",
      distance:
        invoice.distance !== null
          ? String(invoice.distance)
          : "",
      duration:
        invoice.duration !== null
          ? String(invoice.duration)
          : "",
      paymentMethod:
        invoice.paymentMethod ?? "",
    });
  };

  const cancelEditing = () => {
    setEditingInvoiceId(null);
    setEditForm(emptyEditForm);
    setError(null);
  };

  const updateEditField = (
    field: keyof InvoiceEditForm,
    value: string,
  ) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveInvoiceChanges = async (
    invoiceId: string,
  ) => {
    if (!travelId) {
      setError("No pudimos identificar el viaje.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError("Tu sesión ha expirado.");
      router.push("/");
      return;
    }

    try {
      setError(null);
      setSavingInvoiceId(invoiceId);

      const invoiceRef = doc(
        db,
        "users",
        user.uid,
        "travels",
        travelId,
        "invoices",
        invoiceId,
      );

      const amountValue =
        editForm.amount.trim() === ""
          ? null
          : Number(editForm.amount);

      const distanceValue =
        editForm.distance.trim() === ""
          ? null
          : Number(editForm.distance);

      const durationValue =
        editForm.duration.trim() === ""
          ? null
          : Number(editForm.duration);

      if (
        amountValue !== null &&
        !Number.isFinite(amountValue)
      ) {
        setError("El monto no es válido.");
        return;
      }

      if (
        distanceValue !== null &&
        !Number.isFinite(distanceValue)
      ) {
        setError("La distancia no es válida.");
        return;
      }

      if (
        durationValue !== null &&
        !Number.isFinite(durationValue)
      ) {
        setError("La duración no es válida.");
        return;
      }

      await updateDoc(invoiceRef, {
        provider:
          editForm.provider.trim() || null,

        category:
          editForm.category.trim() || null,

        invoiceDate:
          editForm.invoiceDate.trim() || null,

        tripDate:
          editForm.tripDate.trim() || null,

        tripTime:
          editForm.tripTime.trim() || null,

        amount: amountValue,

        invoiceNumber:
          editForm.invoiceNumber.trim() || null,

        origin:
          editForm.origin.trim() || null,

        destination:
          editForm.destination.trim() || null,

        service:
          editForm.service.trim() || null,

        distance: distanceValue,

        duration: durationValue,

        paymentMethod:
          editForm.paymentMethod.trim() || null,

        updatedAt: serverTimestamp(),
      });

      setInvoices((currentInvoices) =>
        currentInvoices.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                provider:
                  editForm.provider.trim() || null,

                category:
                  editForm.category.trim() || null,

                invoiceDate:
                  editForm.invoiceDate.trim() || null,

                tripDate:
                  editForm.tripDate.trim() || null,

                tripTime:
                  editForm.tripTime.trim() || null,

                amount: amountValue,

                invoiceNumber:
                  editForm.invoiceNumber.trim() || null,

                origin:
                  editForm.origin.trim() || null,

                destination:
                  editForm.destination.trim() || null,

                service:
                  editForm.service.trim() || null,

                distance: distanceValue,

                duration: durationValue,

                paymentMethod:
                  editForm.paymentMethod.trim() || null,
              }
            : invoice,
        ),
      );

      setEditingInvoiceId(null);
      setEditForm(emptyEditForm);
    } catch (firebaseError) {
      console.error(
        "ERROR SAVING INVOICE:",
        firebaseError,
      );

      setError(
        "No pudimos guardar los cambios de la factura.",
      );
    } finally {
      setSavingInvoiceId(null);
    }
  };

  const confirmInvoice = async (
    invoiceId: string,
  ) => {
    if (!travelId) {
      setError("No pudimos identificar el viaje.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError("Tu sesión ha expirado.");
      router.push("/");
      return;
    }

    try {
      setError(null);
      setConfirmingInvoiceId(invoiceId);

      const travelInvoiceRef = doc(
        db,
        "users",
        user.uid,
        "travels",
        travelId,
        "invoices",
        invoiceId,
      );

      await updateDoc(travelInvoiceRef, {
        status: "confirmed",
        confirmedAt: serverTimestamp(),
      });

      const invoiceRef = doc(
        db,
        "users",
        user.uid,
        "invoices",
        invoiceId,
      );

      await updateDoc(invoiceRef, {
        status: "confirmed",
        confirmedAt: serverTimestamp(),
        travelId,
        updatedAt: serverTimestamp(),
      });

      setInvoices((currentInvoices) =>
        currentInvoices.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                status: "confirmed",
              }
            : invoice,
        ),
      );
    } catch (firebaseError) {
      console.error(
        "ERROR CONFIRMING INVOICE:",
        firebaseError,
      );

      setError(
        "No pudimos confirmar la factura.",
      );
    } finally {
      setConfirmingInvoiceId(null);
    }
  };

  const inputClassName =
    "mt-2 w-full rounded-xl border border-[#e4e0d9] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#a18d6d] focus:ring-2 focus:ring-[#a18d6d]/10";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] text-[#1d1d1f]">
        <p className="text-sm text-[#8a857c]">
          Cargando viaje...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#1d1d1f]">
      <div className="mx-auto min-h-screen max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 xl:px-14 2xl:px-16">

        {/* Encabezado */}
        <header className="flex items-center gap-4">
          <button
            onClick={() => router.push("/viajes")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e0d9] bg-white text-lg text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-90"
            aria-label="Volver a mis viajes"
          >
            ←
          </button>

          <div>
            <p className="text-sm font-medium text-[#a18d6d]">
              Crystal Reports Cloud
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Viaje
            </h1>
          </div>
        </header>

        {/* Contenido */}
        <section className="mx-auto mt-10 max-w-4xl">

          {/* Cabecera del viaje */}
          <div className="rounded-[28px] border border-[#eeeae4] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f6f1e9] text-2xl">
                🚗
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  Nuevo viaje
                </h2>

                <p className="mt-1 text-sm text-[#77736c]">
                  Facturas asociadas a este viaje.
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-2xl bg-[#fff4f2] p-4 text-sm text-[#9a5b50]">
              {error}
            </div>
          )}

          {/* Facturas */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Facturas
                </h2>

                <p className="mt-1 text-sm text-[#77736c]">
                  Documentos asociados al viaje.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push("/viajes/nuevo")
                }
                className="rounded-xl border border-[#e4e0d9] bg-white px-4 py-2.5 text-sm font-medium text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-95"
              >
                + Agregar
              </button>
            </div>

            {invoices.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-[#dcd5ca] bg-white p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f6f1e9] text-xl">
                  📄
                </div>

                <h3 className="mt-4 font-semibold">
                  No hay facturas
                </h3>

                <p className="mt-2 text-sm text-[#77736c]">
                  Agregá una factura para comenzar.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {invoices.map((invoice) => (
                  <article
                    key={invoice.id}
                    className="rounded-[24px] border border-[#eeeae4] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.02)] sm:p-6"
                  >
                    {/* Encabezado factura */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f8f5f0] text-lg">
                          📄
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {invoice.fileName}
                          </p>

                          <p className="mt-1 text-xs text-[#aaa49a]">
                            {(invoice.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full bg-[#f6f1e9] px-3 py-1 text-xs font-medium text-[#8f7957]">
                        {invoice.status}
                      </span>
                    </div>

                    {/* Datos identificados */}
                    {invoice.status === "review" && (
                      <div className="mt-6 border-t border-[#eeeae4] pt-6">

                        {editingInvoiceId === invoice.id ? (
                          <>
                            <div>
                              <p className="text-sm font-semibold">
                                Editar factura
                              </p>

                              <p className="mt-1 text-xs text-[#aaa49a]">
                                Corregí cualquier dato que Gemini haya identificado incorrectamente.
                              </p>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">

                              <label className="text-xs text-[#77736c]">
                                Proveedor
                                <input
                                  value={editForm.provider}
                                  onChange={(event) =>
                                    updateEditField(
                                      "provider",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Categoría
                                <input
                                  value={editForm.category}
                                  onChange={(event) =>
                                    updateEditField(
                                      "category",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Fecha factura
                                <input
                                  type="date"
                                  value={editForm.invoiceDate}
                                  onChange={(event) =>
                                    updateEditField(
                                      "invoiceDate",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Fecha viaje
                                <input
                                  type="date"
                                  value={editForm.tripDate}
                                  onChange={(event) =>
                                    updateEditField(
                                      "tripDate",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Hora
                                <input
                                  type="time"
                                  value={editForm.tripTime}
                                  onChange={(event) =>
                                    updateEditField(
                                      "tripTime",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Monto
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editForm.amount}
                                  onChange={(event) =>
                                    updateEditField(
                                      "amount",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Número de factura
                                <input
                                  value={
                                    editForm.invoiceNumber
                                  }
                                  onChange={(event) =>
                                    updateEditField(
                                      "invoiceNumber",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Método de pago
                                <input
                                  value={
                                    editForm.paymentMethod
                                  }
                                  onChange={(event) =>
                                    updateEditField(
                                      "paymentMethod",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Servicio
                                <input
                                  value={editForm.service}
                                  onChange={(event) =>
                                    updateEditField(
                                      "service",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Duración (min)
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editForm.duration}
                                  onChange={(event) =>
                                    updateEditField(
                                      "duration",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Distancia (km)
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editForm.distance}
                                  onChange={(event) =>
                                    updateEditField(
                                      "distance",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Origen
                                <input
                                  value={editForm.origin}
                                  onChange={(event) =>
                                    updateEditField(
                                      "origin",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>

                              <label className="text-xs text-[#77736c]">
                                Destino
                                <input
                                  value={editForm.destination}
                                  onChange={(event) =>
                                    updateEditField(
                                      "destination",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </label>
                            </div>

                            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={
                                  savingInvoiceId ===
                                  invoice.id
                                }
                                className="rounded-xl border border-[#e4e0d9] bg-white px-5 py-3 text-sm font-medium text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-95 disabled:opacity-50"
                              >
                                Cancelar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  saveInvoiceChanges(
                                    invoice.id,
                                  )
                                }
                                disabled={
                                  savingInvoiceId ===
                                  invoice.id
                                }
                                className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingInvoiceId ===
                                invoice.id
                                  ? "Guardando..."
                                  : "Guardar cambios"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-semibold">
                                Datos identificados
                              </p>

                              <p className="mt-1 text-xs text-[#aaa49a]">
                                Información extraída automáticamente de la factura.
                              </p>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Proveedor
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.provider ??
                                    "No identificado"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Categoría
                                </p>

                                <p className="mt-1 text-sm font-medium capitalize">
                                  {invoice.category ??
                                    "No identificada"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Fecha
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.invoiceDate ??
                                    "No identificada"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Hora
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.tripTime ??
                                    "No identificada"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Monto
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.amount !== null
                                    ? `₡${invoice.amount.toLocaleString(
                                        "es-CR",
                                      )}`
                                    : "No identificado"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Método de pago
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.paymentMethod ??
                                    "No identificado"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Servicio
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.service ??
                                    "No identificado"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Duración
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.duration !== null
                                    ? `${invoice.duration} min`
                                    : "No identificada"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Origen
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.origin ??
                                    "No identificado"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-[#faf9f7] p-4">
                                <p className="text-xs text-[#aaa49a]">
                                  Destino
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                  {invoice.destination ??
                                    "No identificado"}
                                </p>
                              </div>
                            </div>

                            {invoice.processingError && (
                              <div className="mt-5 rounded-2xl bg-[#fff4f2] p-4 text-sm text-[#9a5b50]">
                                {invoice.processingError}
                              </div>
                            )}

                            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
                              <button
                                type="button"
                                onClick={() =>
                                  startEditingInvoice(
                                    invoice,
                                  )
                                }
                                className="rounded-xl border border-[#e4e0d9] bg-white px-5 py-3 text-sm font-medium text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-95"
                              >
                                Editar factura
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  confirmInvoice(
                                    invoice.id,
                                  )
                                }
                                disabled={
                                  confirmingInvoiceId ===
                                  invoice.id
                                }
                                className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {confirmingInvoiceId ===
                                invoice.id
                                  ? "Confirmando..."
                                  : "Confirmar factura"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Factura confirmada */}
                    {invoice.status === "confirmed" && (
                      <div className="mt-6 border-t border-[#eeeae4] pt-6">
                        <div className="rounded-2xl bg-[#f3f8f3] p-4">
                          <p className="text-sm font-semibold text-[#49624f]">
                            Factura confirmada
                          </p>

                          <p className="mt-1 text-xs text-[#6d7d70]">
                            Esta factura quedó lista para formar parte del historial y las sumatorias.
                          </p>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">

                          <div className="rounded-2xl bg-[#faf9f7] p-4">
                            <p className="text-xs text-[#aaa49a]">
                              Proveedor
                            </p>

                            <p className="mt-1 text-sm font-medium">
                              {invoice.provider ??
                                "No identificado"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#faf9f7] p-4">
                            <p className="text-xs text-[#aaa49a]">
                              Categoría
                            </p>

                            <p className="mt-1 text-sm font-medium capitalize">
                              {invoice.category ??
                                "No identificada"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#faf9f7] p-4">
                            <p className="text-xs text-[#aaa49a]">
                              Fecha
                            </p>

                            <p className="mt-1 text-sm font-medium">
                              {invoice.invoiceDate ??
                                "No identificada"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#faf9f7] p-4">
                            <p className="text-xs text-[#aaa49a]">
                              Monto
                            </p>

                            <p className="mt-1 text-sm font-medium">
                              {invoice.amount !== null
                                ? `₡${invoice.amount.toLocaleString(
                                    "es-CR",
                                  )}`
                                : "No identificado"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        {/* Footer */}
        <footer className="py-10 text-center">
          <p className="text-xs text-[#aaa49a]">
            © 2026 Infinix Dev. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
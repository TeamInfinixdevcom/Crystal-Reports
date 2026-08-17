import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
} from "firebase/storage";

import {
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import { getApp } from "firebase/app";

import { db, storage } from "./firebase";

type ProcessInvoiceResponse = {
  success: boolean;
  invoiceId: string;
  status: string;
  data: {
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
  };
};

export type ProcessedInvoice = {
  invoiceId: string;
  status: string;
  data: ProcessInvoiceResponse["data"];
};

const functions = getFunctions(getApp());

export async function uploadInvoice(
  userId: string,
  travelId: string | null,
  file: File,
): Promise<ProcessedInvoice> {
  const invoicesRef = collection(
    db,
    "users",
    userId,
    "invoices",
  );

  /*
   * ==========================================
   * 1. CREAR FACTURA
   * ==========================================
   */

  const invoiceRef = await addDoc(
    invoicesRef,
    {
      userId,
      travelId,

      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,

      storagePath: null,

      uploadedAt: serverTimestamp(),

      provider: null,
      category: null,

      invoiceDate: null,
      tripDate: null,
      tripTime: null,

      amount: null,
      currency: null,

      invoiceNumber: null,

      origin: null,
      destination: null,

      service: null,
      distance: null,
      duration: null,

      paymentMethod: null,

      status: "uploaded",
      processingError: null,
    },
  );

  const storagePath =
    `users/${userId}/invoices/${invoiceRef.id}/${file.name}`;

  /*
   * ==========================================
   * 2. SUBIR ARCHIVO
   * ==========================================
   */

  const storageRef = ref(
    storage,
    storagePath,
  );

  await uploadBytes(
    storageRef,
    file,
  );

  /*
   * ==========================================
   * 3. GUARDAR RUTA
   * ==========================================
   */

  await updateDoc(
    doc(
      db,
      "users",
      userId,
      "invoices",
      invoiceRef.id,
    ),
    {
      storagePath,
      updatedAt: serverTimestamp(),
    },
  );

  /*
   * ==========================================
   * 4. PROCESAR CON GEMINI
   * ==========================================
   */

  const processInvoice =
    httpsCallable<
      {
        travelId: string | null;
        invoiceId: string;
      },
      ProcessInvoiceResponse
    >(
      functions,
      "processInvoice",
    );

  try {
    const result =
      await processInvoice({
        travelId,
        invoiceId:
          invoiceRef.id,
      });

    /*
     * ==========================================
     * 5. VALIDAR RESPUESTA
     * ==========================================
     */

    if (
      !result.data ||
      !result.data.success
    ) {
      throw new Error(
        "La factura no pudo ser procesada correctamente.",
      );
    }

    /*
     * ==========================================
     * 6. DEVOLVER DATOS PARA VISTA PREVIA
     * ==========================================
     */

    return {
      invoiceId:
        result.data.invoiceId,

      status:
        result.data.status,

      data:
        result.data.data,
    };

  } catch (error) {

    console.error(
      "ERROR AL PROCESAR FACTURA:",
      error,
    );

    /*
     * ==========================================
     * 7. MARCAR ERROR
     * ==========================================
     */

    try {
      await updateDoc(
        doc(
          db,
          "users",
          userId,
          "invoices",
          invoiceRef.id,
        ),
        {
          status: "review",
          processingError:
            error instanceof Error
              ? error.message
              : "Error al procesar la factura.",
          updatedAt:
            serverTimestamp(),
        },
      );
    } catch (
      updateError
    ) {
      console.error(
        "ERROR ACTUALIZANDO ESTADO DE FACTURA:",
        updateError,
      );
    }

    /*
     * ==========================================
     * 8. DETENER FLUJO
     * ==========================================
     *
     * IMPORTANTE:
     *
     * Si Gemini falla, NO continuamos
     * como si la factura estuviera lista.
     */

    throw error;
  }
}
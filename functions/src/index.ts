import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";


admin.initializeApp();

const GEMINI_API_KEY =
  defineSecret("GEMINI_API_KEY");

const EMAIL_INGEST_SECRET =
  defineSecret("EMAIL_INGEST_SECRET");

const SMTP_APP_PASSWORD =
  defineSecret("SMTP_APP_PASSWORD");
const sendUnregisteredEmail = async (
  recipientEmail: string,
): Promise<void> => {
  const transporter =
    nodemailer.createTransport({
      service: "gmail",

      auth: {
        user:
          "crystalreports.facturas@gmail.com",

        pass:
          SMTP_APP_PASSWORD.value(),
      },
    });

  await transporter.sendMail({
    from:
      "Crystal Reports <crystalreports.facturas@gmail.com>",

    to:
      recipientEmail,

    subject:
      "Factura no procesada – Crystal Reports",

    text: `
Hola,

Recibimos tu factura, pero no fue procesada porque la dirección de correo desde la que la enviaste no coincide con la dirección de correo con la que creaste tu cuenta de Crystal Reports.

Importante: para conservar correctamente tus facturas, viajes e historial, debés utilizar siempre la misma cuenta y dirección de correo con la que te registraste en Crystal Reports.

No es necesario crear una nueva cuenta.

Correo desde el que se recibió la factura:
${recipientEmail}

Si ya tenés una cuenta de Crystal Reports creada con otra dirección, ingresá utilizando esa cuenta y reenviá la factura desde el correo asociado a ella.

La factura no fue almacenada ni asignada a ninguna cuenta.

Saludos,

Crystal Reports
Sistema de gestión de gastos
`,
  });
};

/**
 * ==========================================
 * CREAR PERFIL DE USUARIO
 * ==========================================
 */

export const createUserProfile =
  functions
    .runWith({
      maxInstances: 10,
    })
    .auth.user()
    .onCreate(async (user) => {
      const db =
        admin.firestore();

      const userRef =
        db
          .collection("users")
          .doc(user.uid);

      const existingProfile =
        await userRef.get();

      if (existingProfile.exists) {
        return;
      }

      const role =
        user.email ===
        "teaminfinixdev@gmail.com"
          ? "master"
          : "user";

      await userRef.set({
        id: user.uid,

        name:
          user.displayName ??
          "Usuario",

        identification: "",

        email:
          user.email ?? "",

        role,

        travelAllowance: 0,

        currency: "CRC",

        isActive: true,

        createdAt:
          admin.firestore.Timestamp.now(),

        updatedAt:
          admin.firestore.Timestamp.now(),
      });
    });


/**
 * ==========================================
 * LISTAR MODELOS GEMINI
 * ==========================================
 */

export const listGeminiModels =
  functions
    .runWith({
      secrets: [GEMINI_API_KEY],
      maxInstances: 1,
    })
    .https.onCall(
      async (
        data,
        context,
      ) => {
        if (!context.auth) {
          throw new functions.https.HttpsError(
            "unauthenticated",
            "Debés iniciar sesión.",
          );
        }

        const apiKey =
          GEMINI_API_KEY.value();

        if (!apiKey) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "GEMINI_API_KEY no está configurada.",
          );
        }

        try {
          const { GoogleGenAI } =
            await import(
              "@google/genai"
            );

          const ai =
            new GoogleGenAI({
              apiKey,
            });

          const models = [];

          for await (
            const model of
            await ai.models.list()
          ) {
            models.push({
              name:
                model.name,

              displayName:
                model.displayName,
            });
          }

          return {
            success: true,
            models,
          };
        } catch (error) {
          console.error(
            "LIST GEMINI MODELS ERROR:",
            error,
          );

          throw new functions.https.HttpsError(
            "internal",
            "No fue posible consultar los modelos de Gemini.",
          );
        }
      },
    );


/**
 * ==========================================
 * PROCESAR ARCHIVO CON GEMINI
 * ==========================================
 *
 * Función interna reutilizable por:
 * - processInvoice
 * - receiveInvoiceEmail
 */

type ExtractedInvoiceData = {
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

const processInvoiceWithGemini = async (
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractedInvoiceData> => {
  const supportedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];

  if (!supportedTypes.includes(mimeType)) {
    throw new Error(
      `Tipo de archivo no soportado: ${mimeType}`,
    );
  }

  const apiKey =
    GEMINI_API_KEY.value();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY no está configurada.",
    );
  }

  const { GoogleGenAI } =
    await import(
      "@google/genai"
    );

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  const prompt = `
Analizá esta factura o comprobante de gastos de viaje.

El objetivo es extraer únicamente información que aparezca
realmente en el documento.

NO inventés datos.
Si un dato no aparece claramente, devolvé null.

El documento puede corresponder a:
- Uber
- DiDi
- transporte
- combustible
- alimentación
- hospedaje
- peajes
- parqueos
- u otro proveedor.

Identificá automáticamente el proveedor y la categoría.

Respondé exactamente con este objeto JSON:

{
  "provider": string | null,
  "category": string | null,
  "invoiceDate": "YYYY-MM-DD" | null,
  "tripDate": "YYYY-MM-DD" | null,
  "tripTime": "HH:mm" | null,
  "amount": number | null,
  "currency": "CRC" | null,
  "invoiceNumber": string | null,
  "origin": string | null,
  "destination": string | null,
  "service": string | null,
  "distance": number | null,
  "duration": number | null,
  "paymentMethod": string | null
}

Reglas:

- amount debe ser únicamente el monto total final.
- currency debe ser "CRC" para colones costarricenses.
- distance debe expresarse en kilómetros.
- duration debe expresarse en minutos.
- invoiceDate corresponde a la fecha del documento.
- tripDate corresponde a la fecha del viaje cuando aparezca.
- tripTime corresponde a la hora del viaje cuando aparezca.
- provider debe contener el proveedor identificado.
- category debe ser una categoría simple:
  "transporte", "alimentación", "hospedaje",
  "combustible", "peaje", "parqueo" u "otro".
- invoiceNumber debe ser el número de factura,
  recibo, comprobante o documento cuando exista.
- origin y destination deben utilizarse cuando
  aparezcan en el documento.
- service puede contener valores como "UberX",
  "DiDi", "Uber Eats" u otro servicio identificado.

No inventés información.

Respondé únicamente con JSON válido.
`;

  const base64File =
    fileBuffer.toString(
      "base64",
    );

  const response =
    await ai.models.generateContent({
      model:
        "gemini-3.6-flash",

      contents: [
        {
          role: "user",

          parts: [
            {
              inlineData: {
                mimeType,
                data:
                  base64File,
              },
            },

            {
              text:
                prompt,
            },
          ],
        },
      ],

      config: {
        responseMimeType:
          "application/json",
      },
    });

  const responseText =
    response.text?.trim();

  if (!responseText) {
    throw new Error(
      "Gemini no devolvió información.",
    );
  }

  const extractedData =
    JSON.parse(
      responseText,
    ) as Partial<ExtractedInvoiceData>;

  let amount:
    number | null = null;

  let distance:
    number | null = null;

  let duration:
    number | null = null;

  let currency:
    "CRC" | null = null;

  if (
    typeof extractedData.amount ===
    "number"
  ) {
    amount =
      extractedData.amount;
  }

  if (
    typeof extractedData.distance ===
    "number"
  ) {
    distance =
      extractedData.distance;
  }

  if (
    typeof extractedData.duration ===
    "number"
  ) {
    duration =
      extractedData.duration;
  }

  if (
    extractedData.currency ===
    "CRC"
  ) {
    currency =
      "CRC";
  }

  return {
    provider:
      extractedData.provider ??
      null,

    category:
      extractedData.category ??
      null,

    invoiceDate:
      extractedData.invoiceDate ??
      null,

    tripDate:
      extractedData.tripDate ??
      null,

    tripTime:
      extractedData.tripTime ??
      null,

    amount,

    currency,

    invoiceNumber:
      extractedData.invoiceNumber ??
      null,

    origin:
      extractedData.origin ??
      null,

    destination:
      extractedData.destination ??
      null,

    service:
      extractedData.service ??
      null,

    distance,

    duration,

    paymentMethod:
      extractedData.paymentMethod ??
      null,
  };
};

/**
 * ==========================================
 * PROCESAR FACTURA
 * ==========================================
 *
 * Las facturas viven en:
 *
 * users/{userId}/invoices/{invoiceId}
 *
 * travelId es opcional.
 */

export const processInvoice =
  functions
    .runWith({
      secrets: [GEMINI_API_KEY],

      maxInstances: 5,

      timeoutSeconds: 120,

      memory: "512MB",
    })
    .https.onCall(
      async (
        data,
        context,
      ) => {

        /*
         * ==========================================
         * 1. AUTENTICACIÓN
         * ==========================================
         */

        if (!context.auth) {
          throw new functions.https.HttpsError(
            "unauthenticated",
            "Debés iniciar sesión para procesar una factura.",
          );
        }

        const userId =
          context.auth.uid;

        const db =
          admin.firestore();

        let travelId:
          string | null = null;

        if (
          typeof data?.travelId ===
          "string"
        ) {
          travelId =
            data.travelId;
        }

        const invoiceId =
          data?.invoiceId;

        if (
          typeof invoiceId !==
          "string"
        ) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "invoiceId es obligatorio.",
          );
        }

        /*
         * ==========================================
         * 2. OBTENER FACTURA
         * ==========================================
         */

        const invoiceRef =
          db
            .collection("users")
            .doc(userId)
            .collection("invoices")
            .doc(invoiceId);

        const invoiceSnapshot =
          await invoiceRef.get();

        if (
          !invoiceSnapshot.exists
        ) {
          throw new functions.https.HttpsError(
            "not-found",
            "La factura no existe.",
          );
        }

        const invoice =
          invoiceSnapshot.data();

        if (!invoice) {
          throw new functions.https.HttpsError(
            "not-found",
            "No fue posible obtener los datos de la factura.",
          );
        }

        /*
         * ==========================================
         * 3. VALIDAR PROPIETARIO
         * ==========================================
         */

        if (
          invoice.userId !==
          userId
        ) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "No tenés permiso para procesar esta factura.",
          );
        }


        /*
         * ==========================================
         * 4. VALIDAR VIAJE SI EXISTE
         * ==========================================
         */

        if (
          travelId !== null &&
          invoice.travelId !==
            travelId
        ) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "La factura no pertenece al viaje indicado.",
          );
        }


        /*
         * ==========================================
         * 5. VALIDAR ARCHIVO
         * ==========================================
         */

        if (
          !invoice.storagePath
        ) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "La factura no tiene un archivo asociado.",
          );
        }


        /*
         * ==========================================
         * 6. MARCAR PROCESSING
         * ==========================================
         */

        await invoiceRef.update({
          status:
            "processing",

          processingError:
            null,
        });


        try {

          /*
           * ==========================================
           * 7. DESCARGAR ARCHIVO
           * ==========================================
           */

          const bucket =
            admin
              .storage()
              .bucket();

          const storageFile =
            bucket.file(
              invoice.storagePath,
            );

          const [
            fileBuffer,
          ] =
            await storageFile.download();

          if (
            !fileBuffer ||
            fileBuffer.length ===
              0
          ) {
            throw new Error(
              "El archivo está vacío.",
            );
          }

          const mimeType =
            invoice.fileType;

          const supportedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
          ];

          if (
            !supportedTypes.includes(
              mimeType,
            )
          ) {
            throw new Error(
              `Tipo de archivo no soportado: ${mimeType}`,
            );
          }


          /*
           * ==========================================
           * 8. PROCESAR CON GEMINI
           * ==========================================
           */

          const extractedData =
            await processInvoiceWithGemini(
              fileBuffer,
              mimeType,
            );

          /*
           * ==========================================
           * 9. GUARDAR DATOS
           * ==========================================
           */

          await invoiceRef.update({

            provider:
              extractedData.provider ??
              null,

            category:
              extractedData.category ??
              null,

            invoiceDate:
              extractedData.invoiceDate ??
              null,

            tripDate:
              extractedData.tripDate ??
              null,

            tripTime:
              extractedData.tripTime ??
              null,

            amount:
              extractedData.amount,

            currency:
              extractedData.currency,

            invoiceNumber:
              extractedData.invoiceNumber ??
              null,

            origin:
              extractedData.origin ??
              null,

            destination:
              extractedData.destination ??
              null,

            service:
              extractedData.service ??
              null,

            distance:
              extractedData.distance,

            duration:
              extractedData.duration,

            paymentMethod:
              extractedData.paymentMethod ??
              null,

            status:
              "review",

            processingError:
              null,

            processedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp(),
          });


          /*
           * ==========================================
           * 14. RESPUESTA
           * ==========================================
           */

          return {
            success:
              true,

            invoiceId,

            status:
              "review",

            data:
              extractedData,
          };

        } catch (error) {

          console.error(
            "PROCESS INVOICE ERROR:",
            error,
          );

          let processingError =
            "Error desconocido al procesar la factura.";

          if (
            error instanceof Error
          ) {
            processingError =
              error.message;
          }

          await invoiceRef.update({
            status:
              "review",

            processingError,
          });

          throw new functions.https.HttpsError(
            "internal",
            "No fue posible procesar la factura.",
          );
        }
      },
    );


/**
 * ==========================================
 * GENERAR EXPEDIENTE MENSUAL
 * ==========================================
 *
 * Une los PDFs originales del período.
 *
 * El período mensual se determina por
 * uploadedAt, NO por invoiceDate ni tripDate.
 *
 * Cada generación crea un expediente
 * independiente.
 *
 * Los expedientes anteriores NO se reemplazan.
 */

export const generateMonthlyReport =
  functions
    .runWith({
      maxInstances: 3,

      timeoutSeconds: 120,

      memory: "512MB",
    })
    .https.onCall(
      async (
        data,
        context,
      ) => {

        /*
         * ==========================================
         * 1. AUTENTICACIÓN
         * ==========================================
         */

        if (!context.auth) {
          throw new functions.https.HttpsError(
            "unauthenticated",
            "Debés iniciar sesión.",
          );
        }

        const userId =
          context.auth.uid;


        /*
         * ==========================================
         * 2. VALIDAR PERÍODO
         * ==========================================
         */

        const year =
          data?.year;

        const month =
          data?.month;

        if (
          typeof year !==
            "number" ||
          typeof month !==
            "number" ||
          month < 1 ||
          month > 12
        ) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "year y month son obligatorios.",
          );
        }


        /*
         * ==========================================
         * 3. FIRESTORE
         * ==========================================
         */

        const db =
          admin.firestore();


        /*
         * ==========================================
         * 4. OBTENER FACTURAS
         * ==========================================
         */

        const invoicesSnapshot =
          await db
            .collection("users")
            .doc(userId)
            .collection("invoices")
            .get();


        /*
         * ==========================================
         * 5. TIPO DE FACTURA
         * ==========================================
         */

        type MonthlyInvoice = {
          id: string;

          tripDate?:
            string | null;

          invoiceDate?:
            string | null;

          uploadedAt?:
            admin.firestore.Timestamp |
            null;

          storagePath?:
            string | null;

          fileType?:
            string | null;

          amount?:
            number | null;

          status?:
            string | null;
        };


        /*
         * ==========================================
         * 6. CONVERTIR DOCUMENTOS
         * ==========================================
         */

        const invoices:
          MonthlyInvoice[] =
          invoicesSnapshot.docs.map(
            (invoiceDoc) => ({
              id:
                invoiceDoc.id,

              ...(
                invoiceDoc.data() as Omit<
                  MonthlyInvoice,
                  "id"
                >
              ),
            }),
          );


        /*
         * ==========================================
         * 7. FILTRAR FACTURAS DEL PERÍODO
         * ==========================================
         *
         * El período se determina por uploadedAt.
         *
         * Ejemplo:
         *
         * Factura:
         * 31/07/2026
         *
         * Subida:
         * 16/08/2026
         *
         * Pertenece a:
         * AGOSTO 2026
         */

        const filteredInvoices =
          invoices
            .filter(
              (invoice) => {

                if (
                  !invoice.uploadedAt
                ) {
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
            )
            .filter(
              (invoice) =>
                typeof invoice.storagePath ===
                  "string" &&
                invoice.storagePath.length >
                  0,
            )
            .filter(
              (invoice) =>
                invoice.status ===
                  "confirmed" ||
                invoice.status ===
                  "processed",
            );


        /*
         * ==========================================
         * 8. ORDENAR FACTURAS
         * ==========================================
         *
         * uploadedAt define el período.
         *
         * tripDate / invoiceDate
         * definen el orden dentro
         * del expediente.
         */

        filteredInvoices.sort(
          (a, b) => {

            const dateA =
              a.tripDate ??
              a.invoiceDate ??
              "";

            const dateB =
              b.tripDate ??
              b.invoiceDate ??
              "";

            return dateA.localeCompare(
              dateB,
            );
          },
        );


        /*
         * ==========================================
         * 9. VALIDAR FACTURAS
         * ==========================================
         */

        if (
          filteredInvoices.length ===
          0
        ) {
          throw new functions.https.HttpsError(
            "not-found",
            "No existen facturas confirmadas para este período.",
          );
        }


        /*
         * ==========================================
         * 10. CREAR PDF
         * ==========================================
         */

        const {
          PDFDocument,
        } =
          await import(
            "pdf-lib"
          );

        const mergedPdf =
          await PDFDocument.create();

        const bucket =
          admin
            .storage()
            .bucket();

        let pdfCount = 0;


        /*
         * ==========================================
         * 11. UNIR PDFs
         * ==========================================
         */

        for (
          const invoice of
          filteredInvoices
        ) {

          const storagePath =
            invoice.storagePath;

          if (
            typeof storagePath !==
            "string"
          ) {
            continue;
          }

          if (
            invoice.fileType !==
            "application/pdf"
          ) {
            continue;
          }

          const file =
            bucket.file(
              storagePath,
            );

          const [
            buffer,
          ] =
            await file.download();

          if (
            !buffer ||
            buffer.length ===
              0
          ) {
            continue;
          }

          const sourcePdf =
            await PDFDocument.load(
              buffer,
            );

          const pages =
            await mergedPdf.copyPages(
              sourcePdf,
              sourcePdf.getPageIndices(),
            );

          pages.forEach(
            (page) => {
              mergedPdf.addPage(
                page,
              );
            },
          );

          pdfCount++;
        }


        /*
         * ==========================================
         * 12. VALIDAR RESULTADO
         * ==========================================
         */

        if (
          pdfCount === 0 ||
          mergedPdf.getPageCount() ===
            0
        ) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "No se encontraron PDFs válidos para unir.",
          );
        }


        /*
         * ==========================================
         * 13. CALCULAR MONTO
         * ==========================================
         */

        const totalAmount =
          filteredInvoices.reduce(
            (total, invoice) =>
              total +
              (
                typeof invoice.amount ===
                "number"
                  ? invoice.amount
                  : 0
              ),
            0,
          );


        /*
         * ==========================================
         * 14. GENERAR PDF
         * ==========================================
         */

        const mergedBuffer =
          await mergedPdf.save();


        /*
         * ==========================================
         * 15. CREAR REGISTRO ÚNICO
         * ==========================================
         */

        const reportRef =
          db
            .collection("users")
            .doc(userId)
            .collection("reports")
            .doc();

        const reportId =
          reportRef.id;


        /*
         * ==========================================
         * 16. RUTA ÚNICA DEL PDF
         * ==========================================
         */

        const reportPath =
          `users/${userId}/reports/${year}-${String(
            month,
          ).padStart(
            2,
            "0",
          )}/${reportId}.pdf`;

        const reportFile =
          bucket.file(
            reportPath,
          );


        /*
         * ==========================================
         * 17. GUARDAR PDF
         * ==========================================
         */

        await reportFile.save(
          Buffer.from(
            mergedBuffer,
          ),
          {
            metadata: {
              contentType:
                "application/pdf",

              metadata: {
                userId,

                reportId,

                year:
                  String(year),

                month:
                  String(month),

                invoiceCount:
                  String(
                    pdfCount,
                  ),

                totalAmount:
                  String(
                    totalAmount,
                  ),
              },
            },
          },
        );


        /*
         * ==========================================
         * 18. GENERAR URL TEMPORAL
         * ==========================================
         */

        const [
          url,
        ] =
          await reportFile.getSignedUrl(
            {
              action:
                "read",

              expires:
                Date.now() +
                1000 *
                  60 *
                  60,
            },
          );


        /*
         * ==========================================
         * 19. GUARDAR HISTORIAL EN FIRESTORE
         * ==========================================
         */

        await reportRef.set({

          id:
            reportId,

          userId,

          year,

          month,

          invoiceCount:
            pdfCount,

          totalAmount,

          pageCount:
            mergedPdf.getPageCount(),

          storagePath:
            reportPath,

          generatedAt:
            admin.firestore
              .FieldValue
              .serverTimestamp(),

        });


        /*
         * ==========================================
         * 20. RESPUESTA
         * ==========================================
         */

        return {

          success:
            true,

          reportId,

          year,

          month,

          invoiceCount:
            pdfCount,

          totalAmount,

          pageCount:
            mergedPdf.getPageCount(),

          storagePath:
            reportPath,

          url,
        };
      },

      
    );
/**
 * ==========================================
 * RECIBIR FACTURA DESDE CORREO
 * ==========================================
 *
 * Recibe una factura enviada por correo.
 *
 * Flujo:
 * - Valida la solicitud HTTP.
 * - Valida el secreto.
 * - Identifica al usuario por senderEmail.
 * - Convierte el archivo Base64 a Buffer.
 * - Guarda el archivo en Firebase Storage.
 * - Crea el documento de factura en Firestore.
 *
 * Todavía NO procesa con Gemini.
 */

export const receiveInvoiceEmail =
  functions
    .runWith({
      secrets: [
        EMAIL_INGEST_SECRET,
        GEMINI_API_KEY,
        SMTP_APP_PASSWORD,
      ],
      maxInstances: 3,
      timeoutSeconds: 120,
      memory: "512MB",
    })
    .https.onRequest(
      async (req, res) => {
        let invoiceRef:
          any = null;

        try {
          /*
           * ==========================================
           * 1. VALIDAR MÉTODO
           * ==========================================
           */

          if (req.method !== "POST") {
            res.status(405).json({
              success: false,
              error:
                "Método no permitido.",
            });

            return;
          }

          /*
           * ==========================================
           * 2. VALIDAR SECRET
           * ==========================================
           */

          const secret =
            req.headers[
              "x-crystal-email-secret"
            ];

          if (
            secret !==
            EMAIL_INGEST_SECRET.value()
          ) {
            res.status(401).json({
              success: false,
              error:
                "No autorizado.",
            });

            return;
          }

          /*
           * ==========================================
           * 3. OBTENER DATOS
           * ==========================================
           */

          const {
            senderEmail,
            fileName,
            mimeType,
            fileBase64,
            travelId,
          } = req.body ?? {};

          if (
            typeof senderEmail !==
            "string" ||
            typeof fileName !==
            "string" ||
            typeof mimeType !==
            "string" ||
            typeof fileBase64 !==
            "string"
          ) {
            res.status(400).json({
              success: false,
              error:
                "Datos de factura incompletos.",
            });

            return;
          }

          /*
           * ==========================================
           * 4. BUSCAR USUARIO
           * ==========================================
           */

          const db =
            admin.firestore();

          const usersSnapshot =
            await db
              .collection("users")
              .where(
                "email",
                "==",
                senderEmail,
              )
              .limit(1)
              .get();
          if (
            usersSnapshot.empty
          ) {
            try {
              await sendUnregisteredEmail(
                senderEmail,
              );
            } catch (
              emailError
            ) {
              console.error(
                "ERROR ENVIANDO AVISO DE CORREO NO REGISTRADO:",
                emailError,
              );
            }

            res.status(200).json({
              success: false,
              registered: false,
              message:
                "El correo remitente no está registrado en Crystal Reports.",
            });

            return;
          }

          const userId =
            usersSnapshot.docs[0].id;

          const userData =
            usersSnapshot.docs[0].data();

          /*
           * ==========================================
           * 5. VALIDAR ARCHIVO
           * ==========================================
           */

          const fileBuffer =
            Buffer.from(
              fileBase64,
              "base64",
            );
          const fileHash =
            crypto
              .createHash("sha256")
              .update(fileBuffer)
              .digest("hex");

          if (
            fileBuffer.length ===
            0
          ) {

            
            res.status(400).json({
              success: false,
              error:
                "El archivo está vacío.",
            });

            return;
          }

          const supportedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
          ];

          if (
            !supportedTypes.includes(
              mimeType,
            )
          ) {
            res.status(400).json({
              success: false,
              error:
                `Tipo de archivo no soportado: ${mimeType}`,
            });

            return;
          }

          /*
           * ==========================================
           * 6. EVITAR DUPLICADOS
           * ==========================================
           */

          const duplicateSnapshot =
            await db
              .collection("users")
              .doc(userId)
              .collection("invoices")
              .where(
                "fileHash",
                "==",
                fileHash,
              )
              .limit(1)
              .get();

          if (
            !duplicateSnapshot.empty
          ) {
            const duplicateInvoice =
              duplicateSnapshot.docs[0];

            console.log(
              "FACTURA DUPLICADA DETECTADA:",
              {
                userId,
                fileHash,
                invoiceId:
                  duplicateInvoice.id,
              },
            );

            res.status(200).json({
              success: true,
              duplicate: true,
              message:
                "Esta factura ya fue registrada anteriormente.",
              invoiceId:
                duplicateInvoice.id,
            });

            return;
          }

          /*
           * ==========================================
           * 7. CREAR FACTURA
           * ==========================================
           */

          invoiceRef =
            db
              .collection("users")
              .doc(userId)
              .collection("invoices")
              .doc();

          const invoiceId =
            invoiceRef.id;

          /*
           * ==========================================
           * 7. GUARDAR ARCHIVO EN STORAGE
           * ==========================================
           */

          const bucket =
            admin.storage().bucket();

          const safeFileName =
            fileName.replace(
              /[^a-zA-Z0-9._-]/g,
              "_",
            );

          const storagePath =
            `users/${userId}/invoices/${invoiceId}/${safeFileName}`;

          const storageFile =
            bucket.file(
              storagePath,
            );

          await storageFile.save(
            fileBuffer,
            {
              metadata: {
                contentType:
                  mimeType,
              },
            },
          );

          /*
           * ==========================================
           * 8. CREAR DOCUMENTO FIRESTORE
           * ==========================================
           */

          const invoiceData = {
            id:
              invoiceId,

            userId,

            fileHash,

            ...(travelId ? { travelId } : {}),

            fileName:
              safeFileName,

            fileType:
              mimeType,

            storagePath,

            uploadedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp(),

            provider:
              null,

            category:
              null,

            invoiceDate:
              null,

            tripDate:
              null,

            tripTime:
              null,

            amount:
              null,

            currency:
              null,

            invoiceNumber:
              null,

            origin:
              null,

            destination:
              null,

            service:
              null,

            distance:
              null,

            duration:
              null,

            paymentMethod:
              null,

            status:
              "processing",

            processingError:
              null,
          };

          await invoiceRef.set(
            invoiceData,
          );

          /*
           * ==========================================
           * 9. PROCESAR AUTOMÁTICAMENTE CON GEMINI
           * ==========================================
           */

          const extractedData =
            await processInvoiceWithGemini(
              fileBuffer,
              mimeType,
            );

          /*
           * ==========================================
           * 10. GUARDAR RESULTADO
           * ==========================================
           */

          await invoiceRef.update({
            provider:
              extractedData.provider,

            category:
              extractedData.category,

            invoiceDate:
              extractedData.invoiceDate,

            tripDate:
              extractedData.tripDate,

            tripTime:
              extractedData.tripTime,

            amount:
              extractedData.amount,

            currency:
              extractedData.currency,

            invoiceNumber:
              extractedData.invoiceNumber,

            origin:
              extractedData.origin,

            destination:
              extractedData.destination,

            service:
              extractedData.service,

            distance:
              extractedData.distance,

            duration:
              extractedData.duration,

            paymentMethod:
              extractedData.paymentMethod,

            status:
              "review",

            processingError:
              null,

            processedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp(),
          });

          /*
           * ==========================================
           * 11. RESPUESTA
           * ==========================================
           */

          console.log(
            "FACTURA RECIBIDA Y PROCESADA DESDE CORREO:",
            {
              userId,
              invoiceId,
              senderEmail,
              storagePath,
            },
          );

          res.status(200).json({
            success: true,

            message:
              "Factura recibida, guardada y procesada correctamente.",

            userId,

            invoiceId,

            userName:
              userData.name ??
              null,

            senderEmail,

            storagePath,

            status:
              "review",

            data:
              extractedData,
          });
        } catch (error) {
          console.error(
            "ERROR RECIBIENDO FACTURA POR CORREO:",
            error,
          );

          if (
            invoiceRef !== null
          ) {
            try {
              await invoiceRef.update({
                status:
                  "review",

                processingError:
                  error instanceof Error
                    ? error.message
                    : "Error desconocido al procesar la factura.",
              });
            } catch (
              updateError
            ) {
              console.error(
                "ERROR ACTUALIZANDO FACTURA DESPUÉS DEL ERROR:",
                updateError,
              );
            }
          }

          res.status(500).json({
            success: false,
            error:
              "Error interno procesando la factura.",
          });
        }
      },
    );

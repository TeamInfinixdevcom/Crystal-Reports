"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

type Invoice = {
  amount?: number | null;
  tripDate?: string | null;
  invoiceDate?: string | null;
  uploadedAt?: Timestamp | null;
  status?: string | null;
};

type ProfileWithAllowance = {
  monthlyAllowance?: number | null;
};

type Report = {
  generatedAt?: Timestamp | null;
};

export default function Summary() {
  const [travelCount, setTravelCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [expedientCount, setExpedientCount] = useState(0);
  const [monthlyAllowance, setMonthlyAllowance] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setTravelCount(0);
          setTotalAmount(0);
          setDocumentCount(0);
          setExpedientCount(0);
          setMonthlyAllowance(0);
          return;
        }

        try {
          /*
           * ==========================================
           * PERFIL
           * ==========================================
           */

          const profileRef = doc(
            db,
            "users",
            user.uid,
          );

          const profileSnapshot =
            await getDoc(profileRef);

          const profile =
            profileSnapshot.exists()
              ? (profileSnapshot.data() as ProfileWithAllowance)
              : null;

          const allowance =
            typeof profile?.monthlyAllowance === "number"
              ? profile.monthlyAllowance
              : 0;

          setMonthlyAllowance(allowance);

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

          const invoices =
            invoicesSnapshot.docs.map(
              (invoiceDoc) =>
                invoiceDoc.data() as Invoice,
            );

          const now = new Date();

          const currentMonth =
            now.getMonth();

          const currentYear =
            now.getFullYear();

          /*
           * ==========================================
           * PERÍODO DEL SISTEMA
           * ==========================================
           *
           * Una factura pertenece al mes en que
           * fue subida al sistema.
           */

          const monthlyInvoices =
            invoices.filter(
              (invoice) => {
                if (!invoice.uploadedAt) {
                  return false;
                }

                const uploadedDate =
                  invoice.uploadedAt.toDate();

                return (
                  uploadedDate.getMonth() ===
                    currentMonth &&
                  uploadedDate.getFullYear() ===
                    currentYear
                );
              },
            );

          /*
           * ==========================================
           * 1 FACTURA = 1 VIAJE
           * ==========================================
           */

          const travelCountValue =
            monthlyInvoices.length;

          /*
           * ==========================================
           * TOTAL DE VIÁTICOS
           * ==========================================
           */

          const amount =
            monthlyInvoices.reduce(
              (total, invoice) =>
                total +
                (typeof invoice.amount === "number"
                  ? invoice.amount
                  : 0),
              0,
            );

          /*
           * ==========================================
           * DOCUMENTOS
           * ==========================================
           */

          const documentCountValue =
            monthlyInvoices.length;

          /*
           * ==========================================
           * EXPEDIENTES
           * ==========================================
           *
           * Los expedientes NO se calculan desde
           * las facturas.
           *
           * Cada PDF generado crea un documento
           * independiente en:
           *
           * users/{uid}/reports/{reportId}
           *
           * Por eso contamos los reportes generados
           * durante el mes actual.
           */

          const reportsRef = collection(
            db,
            "users",
            user.uid,
            "reports",
          );

          const reportsSnapshot =
            await getDocs(reportsRef);

          const reports =
            reportsSnapshot.docs.map(
              (reportDoc) =>
                reportDoc.data() as Report,
            );

          const monthlyReports =
            reports.filter(
              (report) => {
                if (!report.generatedAt) {
                  return false;
                }

                const generatedDate =
                  report.generatedAt.toDate();

                return (
                  generatedDate.getMonth() ===
                    currentMonth &&
                  generatedDate.getFullYear() ===
                    currentYear
                );
              },
            );

          setTravelCount(
            travelCountValue,
          );

          setTotalAmount(amount);

          setDocumentCount(
            documentCountValue,
          );

          setExpedientCount(
            monthlyReports.length,
          );
        } catch (error) {
          console.error(
            "ERROR CARGANDO RESUMEN:",
            error,
          );
        }
      },
    );

    return unsubscribe;
  }, []);

  /*
   * ==========================================
   * CÁLCULO DEL VIÁTICO
   * ==========================================
   */

  const percentage =
    monthlyAllowance > 0
      ? (totalAmount / monthlyAllowance) * 100
      : 0;

  const usedPercentage =
    Math.max(0, percentage);

  const availableAmount =
    Math.max(
      0,
      monthlyAllowance - totalAmount,
    );

  /*
   * ==========================================
   * COLOR DEL INDICADOR
   * ==========================================
   */

  let progressColor = "bg-[#6f9f7b]";
  let percentageColor = "text-[#52705a]";

  if (usedPercentage >= 85) {
    progressColor = "bg-[#b85c5c]";
    percentageColor = "text-[#9a4c4c]";
  } else if (usedPercentage >= 70) {
    progressColor = "bg-[#c5a85c]";
    percentageColor = "text-[#987f3f]";
  } else if (usedPercentage >= 50) {
    progressColor = "bg-[#668bb5]";
    percentageColor = "text-[#55799f]";
  }

  const progressWidth =
    Math.min(100, usedPercentage);

  const items = [
    {
      label: "Viajes este mes",
      value: travelCount.toString(),
      description: "Viajes registrados",
    },
    {
      label: "Viático mensual",
      value:
        `₡${monthlyAllowance.toLocaleString(
          "es-CR",
        )}`,
      description:
        monthlyAllowance > 0
          ? `Gastado: ₡${totalAmount.toLocaleString(
              "es-CR",
            )}`
          : "Configurá tu viático en Mi perfil",
    },
    {
      label: "Documentos",
      value: documentCount.toString(),
      description: "Cargados este mes",
    },
    {
      label: "Expedientes",
      value: expedientCount.toString(),
      description: "Generados este mes",
    },
  ];

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold">
        Resumen
      </h2>

      <div className="grid overflow-hidden rounded-[24px] border border-[#eeeae4] bg-white sm:grid-cols-2 lg:grid-cols-4">

        {items.map(
          (item, index) => (
            <div
              key={item.label}
              className={`p-6 ${
                index < items.length - 1
                  ? "border-b border-[#eeeae4] lg:border-b-0 lg:border-r"
                  : ""
              }`}
            >
              <p className="text-sm text-[#8a857c]">
                {item.label}
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {item.value}
              </p>

              <p className="mt-1 text-xs text-[#aaa49a]">
                {item.description}
              </p>

              {item.label ===
                "Viático mensual" &&
                monthlyAllowance > 0 && (
                  <div className="mt-4">

                    <div className="flex items-center justify-between text-xs">

                      <span
                        className={
                          percentageColor
                        }
                      >
                        {usedPercentage.toLocaleString(
                          "es-CR",
                          {
                            maximumFractionDigits: 1,
                          },
                        )}
                        % utilizado
                      </span>

                      <span className="text-[#aaa49a]">
                        Disponible: ₡
                        {availableAmount.toLocaleString(
                          "es-CR",
                        )}
                      </span>

                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eeeae4]">

                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        style={{
                          width: `${progressWidth}%`,
                        }}
                      />

                    </div>

                  </div>
                )}

            </div>
          ),
        )}

      </div>
    </section>
  );
}
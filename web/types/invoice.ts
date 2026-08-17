export type InvoiceStatus =
  | "uploaded"
  | "processing"
  | "review"
  | "confirmed"
  | "rejected";

export type Invoice = {
  id: string;

  userId: string;
  travelId: string;

  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;

  uploadedAt: string;

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

  status: InvoiceStatus;
  processingError: string | null;
};
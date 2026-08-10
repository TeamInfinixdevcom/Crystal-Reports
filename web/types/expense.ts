export type Expense = {
  id: string;

  userId: string;

  travelDate: string;
  travelTime: string;

  provider: "uber" | "didi" | "other";

  amount: number;
  currency: "CRC";

  invoiceHash: string;
  invoiceNumber?: string;

  invoiceStoragePath: string;

  createdAt: string;

  status: "pending" | "confirmed" | "presented";
};
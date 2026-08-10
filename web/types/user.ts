export type UserRole = "master" | "admin" | "user";

export type User = {
  id: string;

  name: string;
  identification: string;
  email: string;

  role: UserRole;

  travelAllowance: number;
  currency: "CRC";

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
};
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "Rp 0";
  }
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDateIndo(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd MMMM yyyy", { locale: id });
  } catch {
    return String(date);
  }
}

export function formatDateTimeIndo(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd MMM yyyy, HH:mm", { locale: id });
  } catch {
    return String(date);
  }
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD sesuai zona waktu WIB (Asia/Jakarta, UTC+7).
 */
export function getTodayDateWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Menghitung rentang waktu awal hari (00:00:00) dan akhir hari (23:59:59.999) dalam zona waktu WIB (UTC+7).
 * Sangat penting untuk deployment Vercel agar transaksi antara jam 00:00 - 07:00 pagi tidak dianggap hari kemarin.
 */
export function getWIBDayRange(dateInput?: Date | string): { start: Date; end: Date; dateStr: string } {
  let dateStr: string;
  if (!dateInput) {
    dateStr = getTodayDateWIB();
  } else if (typeof dateInput === "string") {
    dateStr = dateInput.split("T")[0];
  } else {
    dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateInput);
  }

  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end, dateStr };
}

/**
 * Menghitung rentang awal bulan dan akhir bulan dalam zona waktu WIB (UTC+7).
 */
export function getWIBMonthRange(yearNum?: number, monthIndex?: number): { start: Date; end: Date } {
  const parts = getTodayDateWIB().split("-").map(Number);
  const y = yearNum ?? parts[0];
  const m = monthIndex !== undefined ? monthIndex : parts[1] - 1; // 0-indexed

  const startStr = `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00.000+07:00`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const endStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`;
  return { start: new Date(startStr), end: new Date(endStr) };
}

export function generateInvoiceNumber(): string {
  const dateStr = getTodayDateWIB().replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AD-${dateStr}-${rand}`;
}


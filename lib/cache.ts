/**
 * Simple in-memory cache untuk mengurangi DB calls berulang di Vercel serverless.
 * Setiap entry punya TTL (Time-To-Live) dalam detik.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlSeconds: number = 30): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidateCache(prefix: string): void {
  const cleanPrefix = prefix.replace(/:+$/, "");
  Array.from(cache.keys()).forEach((key) => {
    if (key.startsWith(cleanPrefix) || key.startsWith(prefix)) {
      cache.delete(key);
    }
  });
}

export function invalidateAll(): void {
  cache.clear();
}

/**
 * Wrapper: ambil dari cache jika ada, kalau tidak fetch lalu simpan ke cache.
 * Cache aktif untuk SEMUA mode termasuk Supabase agar tidak membebani DB setiap request.
 * TTL pendek memastikan data tetap cukup segar.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  setCached(key, data, ttlSeconds);
  return data;
}

// TTL constants (dalam detik)
export const TTL = {
  DASHBOARD: 15,       // Dashboard stats — 15 detik
  PRODUCTS: 20,        // Produk & stok — 20 detik
  SERVICES: 30,        // Layanan (jarang berubah) — 30 detik
  BARBERMEN: 30,       // Barberman (jarang berubah) — 30 detik
  CUSTOMERS: 15,       // Pelanggan — 15 detik
  MEMBERS: 20,         // Member — 20 detik
  BOOKINGS: 10,        // Booking (sering berubah) — 10 detik
  TRANSACTIONS: 10,    // Transaksi (sering berubah) — 10 detik
  CASH: 10,            // Kas — 10 detik
  REPORTS: 30,         // Laporan — 30 detik
  SETTINGS: 60,        // Pengaturan (sangat jarang berubah) — 60 detik
  AUTH: 30,            // Auth session — 30 detik
};

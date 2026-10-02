# Perbaikan Persistence & Sinkronisasi AD BARBERSHOP

## Masalah yang ditemukan
- `memoryDB`/`data/local-db.json` sebelumnya diperlakukan sebagai sumber kebenaran utama.
- Supabase/Prisma hanya dipakai sebagai dual-write/background sync pada banyak operasi.
- Banyak error Prisma ditelan (`catch` tanpa melempar error), sehingga UI dapat mengatakan operasi berhasil walaupun database gagal.
- Pada Vercel, filesystem `/tmp` bersifat ephemeral dan tidak dibagi antar instance.
- Cache proses lokal dapat membuat data lama terlihat sampai TTL habis.
- Checkout sebelumnya membangun transaksi di memory terlebih dahulu; persistensi database tidak atomic dan error dapat diabaikan.
- Pengurangan stok produk per cabang tidak dipersistenkan secara atomic ke database.

## Perubahan
- Supabase PostgreSQL menjadi sumber kebenaran ketika `DATABASE_URL` tersedia.
- Snapshot memory di-refresh dari database dan tidak lagi ditimpa oleh `local-db.json` ketika database persisten aktif.
- `safeDb()` sekarang database-first; jika database gagal, mutasi tidak dilaporkan sukses.
- CRUD barberman/customer memakai database terlebih dahulu saat Supabase aktif.
- Checkout memakai satu PostgreSQL transaction untuk customer, transaksi, item, pembayaran, kas, dan stok produk.
- Stok `stock_telkom`/`stock_suta` dibaca dan diubah melalui SQL di dalam transaction.
- Cache proses dibypass saat Supabase aktif agar perubahan antar request/instance tidak tertahan oleh TTL cache.
- Endpoint service/settings/product memakai `no-store` saat membaca data mutable.

## Verifikasi
- TypeScript: `tsc --noEmit` berhasil.
- Production build penuh tidak dapat dijalankan di environment pemeriksaan ini karena Next.js/Prisma mencoba mengunduh binary dari internet yang tidak tersedia. Jalankan `npm run build` setelah dependency/binary tersedia di mesin/deployment.

## Environment Vercel
Pastikan `DATABASE_URL` benar-benar menunjuk ke Supabase PostgreSQL pooler dan bukan placeholder. Jangan upload `.env` berisi secret.

/**
 * Script: seed-to-supabase.js
 * Menyalin 30 transaksi demo (20 Telkom + 10 Suta) ke Supabase PostgreSQL via Prisma
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl || dbUrl.includes('[YOUR-') || dbUrl.includes('placeholder')) {
    console.log('ℹ️ DATABASE_URL belum dikonfigurasi ke Supabase aktif.');
    console.log('ℹ️ Data demo 30 transaksi sudah tersimpan lengkap di data/local-db.json!');
    return;
  }

  console.log('Connecting to database...');
  const dbPath = path.join(__dirname, '..', 'data', 'local-db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('File local-db.json tidak ditemukan.');
    return;
  }

  const localDB = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(`Memuat ${localDB.transactions.length} transaksi dari local-db.json...`);

  // Pastikan customer tersimpan
  for (const c of localDB.customers) {
    try {
      await prisma.customer.upsert({
        where: { id: c.id },
        update: {
          name: c.name,
          phone: c.phone || null,
          instagram: c.instagram || null,
          branch: c.branch || 'Telkom',
          isMember: c.isMember || false,
          totalVisits: c.totalVisits || 0,
          totalSpend: c.totalSpend || 0,
        },
        create: {
          id: c.id,
          name: c.name,
          phone: c.phone || null,
          instagram: c.instagram || null,
          branch: c.branch || 'Telkom',
          isMember: c.isMember || false,
          totalVisits: c.totalVisits || 0,
          totalSpend: c.totalSpend || 0,
        },
      });
    } catch (e) {
      // ignore
    }
  }
  console.log(`✅ Customers disinkronkan ke Supabase.`);

  // Simpan transaksi
  let txSuccess = 0;
  for (const tx of localDB.transactions) {
    try {
      await prisma.transaction.upsert({
        where: { id: tx.id },
        update: {
          invoiceNumber: tx.invoiceNumber,
          branch: tx.branch,
          subtotal: tx.subtotal,
          discount: tx.discount,
          grandTotal: tx.grandTotal,
          paymentMethod: tx.paymentMethod,
          paymentStatus: tx.paymentStatus,
          notes: tx.notes || null,
        },
        create: {
          id: tx.id,
          invoiceNumber: tx.invoiceNumber,
          customerId: tx.customerId,
          customerName: tx.customerName,
          customerPhone: tx.customerPhone || null,
          customerInstagram: tx.instagram || null,
          barbermanId: tx.barbermanId,
          branch: tx.branch,
          subtotal: tx.subtotal,
          discount: tx.discount,
          grandTotal: tx.grandTotal,
          paymentMethod: tx.paymentMethod,
          paymentStatus: tx.paymentStatus,
          notes: tx.notes || null,
          createdAt: new Date(tx.createdAt),
          updatedAt: new Date(tx.updatedAt),
        },
      });
      txSuccess++;
    } catch (e) {
      console.warn(`⚠️ Gagal simpan tx ${tx.id}:`, e.message);
    }
  }

  console.log(`✅ Berhasil menyinkronkan ${txSuccess}/${localDB.transactions.length} transaksi ke Supabase.`);
}

main()
  .catch((e) => {
    console.error('Error seeding to supabase:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

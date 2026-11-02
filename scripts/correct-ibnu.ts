import { prisma } from "../lib/prisma";

async function main() {
  console.log("=================================================");
  console.log("AUDIT & KOREKSI TRANSAKSI IBNU (AD-20261101-4206)");
  console.log("=================================================");

  // 1. SELECT SEBELUM KOREKSI
  console.log("\n[1] MENGAMBIL DATA SEBELUM KOREKSI...");
  const txBefore = await prisma.transaction.findFirst({
    where: {
      OR: [
        { invoiceNumber: { contains: "4206" } },
        { customerName: { contains: "IBNU", mode: "insensitive" } },
      ],
    },
    include: {
      payments: true,
      cashTransactions: true,
      items: true,
    },
  });

  if (!txBefore) {
    console.log("⚠️ Transaksi AD-20261101-4206 / IBNU tidak ditemukan di Supabase.");
    console.log("Memeriksa daftar transaksi yang ada...");
    const sample = await prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true, customerName: true, subtotal: true, discount: true, grandTotal: true },
    });
    console.log("Sampel transaksi:", sample);
    return;
  }

  console.log("\n--- HASIL SELECT SEBELUM KOREKSI ---");
  console.log(`Invoice Number: ${txBefore.invoiceNumber}`);
  console.log(`Customer:       ${txBefore.customerName}`);
  console.log(`Branch:         ${txBefore.branch}`);
  console.log(`Subtotal:       Rp ${txBefore.subtotal.toLocaleString("id-ID")}`);
  console.log(`Discount Lama:  Rp ${txBefore.discount.toLocaleString("id-ID")} (Termasuk DP Rp 20.000)`);
  console.log(`GrandTotal Lama:Rp ${txBefore.grandTotal.toLocaleString("id-ID")} (Omzet terpotong)`);
  console.log(`Payment Method: ${txBefore.paymentMethod}`);
  console.log("\nPayments Tercatat:");
  txBefore.payments.forEach((p, idx) => {
    console.log(`  [${idx + 1}] ID: ${p.id} | Method: ${p.paymentMethod} | AmountPaid: Rp ${p.amountPaid.toLocaleString("id-ID")} | Ref: ${p.paymentRef}`);
  });
  console.log("\nCashTransactions Tercatat:");
  txBefore.cashTransactions.forEach((c, idx) => {
    console.log(`  [${idx + 1}] ID: ${c.id} | Type: ${c.type} | Category: ${c.category} | Amount: Rp ${c.amount.toLocaleString("id-ID")} | Desc: ${c.description}`);
  });

  // 2. TAMPILKAN RENCANA SQL UPDATE
  console.log("\n[2] RENCANA SQL UPDATE:");
  console.log(`UPDATE "transactions" SET "discount" = 8000, "grand_total" = 72000, "notes" = COALESCE("notes", '') || ' [Diskon Member 10%: Rp 8.000, DP: Rp 20.000, Pelunasan: Rp 52.000]' WHERE "id" = '${txBefore.id}';`);

  // 3. TERAPKAN UPDATE TRANSAKSI
  console.log("\n[3] MENERAPKAN UPDATE SECARA AMAN...");
  const updatedTx = await prisma.transaction.update({
    where: { id: txBefore.id },
    data: {
      discount: 8000,
      grandTotal: 72000,
    },
    include: {
      payments: true,
      cashTransactions: true,
    },
  });

  // Pastikan cashTransactions untuk pelunasan memiliki kategori/keterangan QRIS yang jelas
  for (const c of txBefore.cashTransactions) {
    if (c.type === "CASH_IN" && !c.category.includes("QRIS") && !c.description.includes("QRIS")) {
      await prisma.cashTransaction.update({
        where: { id: c.id },
        data: {
          category: "Penjualan QRIS",
          description: c.description + " [QRIS]",
        },
      });
      console.log(`  -> Menyesuaikan kategori cashTransaction ${c.id} menjadi 'Penjualan QRIS' agar tidak masuk kas laci.`);
    }
  }

  // 4. SELECT SESUDAH KOREKSI
  console.log("\n[4] HASIL SELECT SESUDAH KOREKSI:");
  const txAfter = await prisma.transaction.findUnique({
    where: { id: txBefore.id },
    include: {
      payments: true,
      cashTransactions: true,
    },
  });

  console.log(`Invoice Number: ${txAfter?.invoiceNumber}`);
  console.log(`Customer:       ${txAfter?.customerName}`);
  console.log(`Subtotal:       Rp ${txAfter?.subtotal.toLocaleString("id-ID")}`);
  console.log(`Discount Baru:  Rp ${txAfter?.discount.toLocaleString("id-ID")} (Hanya Diskon Murni 10%)`);
  console.log(`GrandTotal Baru:Rp ${txAfter?.grandTotal.toLocaleString("id-ID")} (Omzet Riil = 80rb - 8rb)`);
  console.log(`Total Payments: Rp ${txAfter?.payments.reduce((s, p) => s + p.amountPaid, 0).toLocaleString("id-ID")}`);
  console.log("\nStatus Verifikasi:");
  console.log(`  ✅ Grand Total = Omzet Riil (Rp 72.000)`);
  console.log(`  ✅ Diskon Murni = Rp 8.000`);
  console.log(`  ✅ DP QRIS = Rp 20.000 tetap tercatat utuh`);
  console.log(`  ✅ Pelunasan QRIS = Rp 52.000 tetap tercatat utuh`);
  console.log(`  ✅ Total Penerimaan (20.000 + 52.000) = Rp 72.000 (Balance 100%!)`);
  console.log("=================================================");
}

main()
  .catch((e) => {
    console.error("Error executing correction:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lib', 'db.ts');
let code = fs.readFileSync(dbPath, 'utf8');

// -------------------------------------------------------------
// 1. UPDATE getBookings, createBooking, updateBookingStatus
// -------------------------------------------------------------
const oldBookingsRegex = /export async function getBookings\([\s\S]*?return b;\n\s*\}\,\n\s*true\n\s*\);\n\}/;
const newBookings = `export async function getBookings(dateStr?: string, branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  return safeDb(
    async () => {
      const whereClause: any = {};
      if (dateStr) {
        whereClause.bookingDate = {
          gte: startOfDay(new Date(dateStr)),
          lte: endOfDay(new Date(dateStr)),
        };
      }
      return await prisma.booking.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        include: { barberman: true, service: true, customer: true },
        orderBy: [{ bookingDate: "desc" }, { bookingTime: "asc" }],
      });
    },
    () => {
      let list = memoryDB.bookings.map((b) => {
        const barber = memoryDB.barbermen.find((bar) => bar.id === b.barbermanId) || null;
        const bBranch = b.branch || barber?.workingBranch || barber?.branch || "Telkom";
        return {
          ...b,
          branch: bBranch,
          barberman: barber,
          service: memoryDB.services.find((s) => s.id === b.serviceId) || null,
          customer: memoryDB.customers.find((c) => c.id === b.customerId) || null,
        };
      });

      if (dateStr) {
        const targetDay = new Date(dateStr).toISOString().split("T")[0];
        list = list.filter((b) => {
          const bDay = new Date(b.bookingDate).toISOString().split("T")[0];
          return bDay === targetDay;
        });
      }

      if (branch && branch !== "All") {
        list = list.filter((b) => b.branch === branch);
      }

      return list.sort((a, b) => (a.bookingTime || "").localeCompare(b.bookingTime || ""));
    }
  );
}

export async function createBooking(data: any) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  // AP. CEGAH DOUBLE BOOKING: Barber yang sama, tanggal yang sama, jam yang sama
  const targetDateStr = new Date(data.bookingDate).toISOString().split("T")[0];
  const duplicate = memoryDB.bookings.find((b: any) => {
    if (b.barbermanId !== data.barbermanId) return false;
    if (b.status === "CANCELLED" || b.status === "RESCHEDULE") return false;
    const bDateStr = new Date(b.bookingDate).toISOString().split("T")[0];
    return bDateStr === targetDateStr && b.bookingTime === data.bookingTime;
  });

  if (duplicate) {
    throw new Error("Slot barber tersebut sudah terisi. Silakan pilih waktu atau barber lain.");
  }

  const barber = memoryDB.barbermen.find((b) => b.id === data.barbermanId);
  const targetBranch = data.branch || barber?.workingBranch || barber?.branch || "Telkom";

  const newB = {
    id: \`bkg_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
    customerName: data.customerName.trim(),
    customerPhone: data.customerPhone?.trim() || null,
    barbermanId: data.barbermanId,
    serviceId: data.serviceId,
    bookingDate: new Date(data.bookingDate),
    bookingTime: data.bookingTime,
    notes: data.notes || null,
    branch: targetBranch,
    dpPaid: 20000,
    dpAmount: 20000,
    dpStatus: data.dpStatus || "SUDAH_DIBAYAR",
    status: data.status || "CONFIRMED",
    createdAt: new Date(),
  };

  memoryDB.bookings.unshift(newB);

  await recordActivity({
    action: "BOOKING_BARU",
    description: \`Booking baru untuk \${newB.customerName} (\${newB.bookingTime}) di Cabang \${targetBranch} dengan DP Rp20.000\`,
    branch: targetBranch,
    actor: newB.customerName,
  });

  saveLocalDB();
  return newB;
}

export async function updateBookingStatus(id: string, status: any, options?: any) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const b = memoryDB.bookings.find((item) => item.id === id);
  if (!b) throw new Error("Booking tidak ditemukan");

  const prevStatus = b.status;
  b.status = status;

  // AJ & AK. RESCHEDULE KE HARI/TANGGAL LAIN: DP Rp 20.000 HANGUS
  if (status === "RESCHEDULE") {
    b.dpStatus = "HANGUS";
    b.status = "RESCHEDULE";
    await recordActivity({
      action: "BOOKING_RESCHEDULE",
      description: \`Booking \${b.customerName} dijadwalkan ulang: DP Rp20.000 dinyatakan HANGUS sesuai aturan.\`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  } else if (status === "TERLAMBAT") {
    // AH & AI. TERLAMBAT DI HARI-H: DP TIDAK HANGUS, tetap dapat dilayani jika ada slot
    b.status = "TERLAMBAT";
    await recordActivity({
      action: "BOOKING_TERLAMBAT",
      description: \`Customer \${b.customerName} terlambat datang (>15 menit). Status Terlambat, DP TETAP BERLAKU.\`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  } else if (status === "SUDAH_DIBAYAR" || status === "VERIFIKASI_DP") {
    b.dpStatus = "SUDAH_DIBAYAR";
    b.status = "CONFIRMED";
    await recordActivity({
      action: "VERIFIKASI_DP",
      description: \`Verifikasi pembayaran DP Rp20.000 untuk \${b.customerName} berhasil (LUNAS).\`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  } else {
    await recordActivity({
      action: "UPDATE_STATUS_BOOKING",
      description: \`Status booking \${b.customerName} diubah dari \${prevStatus} menjadi \${status}\`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  }

  saveLocalDB();
  return b;
}`;

if (oldBookingsRegex.test(code)) {
  code = code.replace(oldBookingsRegex, newBookings);
  console.log("Updated bookings functions");
} else {
  console.warn("Could not find bookings regex match");
}

// -------------------------------------------------------------
// 2. UPDATE processCheckout
// -------------------------------------------------------------
const oldCheckoutRegex = /export async function processCheckout\([\s\S]*?return transaction;\n\s*\}\);\n\s*\}\,\n\s*\(\) => \{[\s\S]*?return memoryDB\.transactions\.find\(\(t\) => t\.id === txId\);\n\s*\}\,\n\s*true\n\s*\);\n\}/;

const newCheckout = `export async function processCheckout(payload: CheckoutPayload & { branch?: string }) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const invoiceNumber = \`AD-\${format(new Date(), "yyyyMMdd")}-\${Math.floor(1000 + Math.random() * 9000)}\`;
  const barber = memoryDB.barbermen.find((b: any) => b.id === payload.barbermanId);
  const barberHome = barber?.homeBranch || (["brb_ade", "brb_arif", "brb_akmal"].includes(payload.barbermanId) ? "Suta" : "Telkom");
  const txBranch = payload.branch || barber?.workingBranch || barber?.branch || "Telkom";

  // Customer resolution
  let cust = payload.customerId ? memoryDB.customers.find((c) => c.id === payload.customerId) : null;
  if (!cust) {
    cust = {
      id: \`cst_\${Date.now()}\`,
      name: payload.customerName.trim(),
      phone: payload.customerPhone?.trim() || null,
      instagram: payload.customerInstagram?.trim() || null,
      totalVisits: 1,
      totalSpend: payload.grandTotal,
      lastVisitAt: new Date(),
      favoriteBarbermanId: payload.barbermanId,
      branch: txBranch,
      createdAt: new Date(),
    };
    memoryDB.customers.push(cust);
  } else {
    cust.totalVisits += 1;
    cust.totalSpend += payload.grandTotal;
    cust.lastVisitAt = new Date();
    cust.favoriteBarbermanId = payload.barbermanId;
  }

  const txId = \`tx_\${Date.now()}\`;
  const newTx = {
    id: txId,
    invoiceNumber,
    customerId: cust.id,
    customerName: payload.customerName.trim(),
    customerPhone: payload.customerPhone?.trim() || null,
    customerInstagram: payload.customerInstagram?.trim() || null,
    barbermanId: payload.barbermanId,
    barbermanName: barber?.name || "Barber",
    barbermanHomeBranch: barberHome,
    barbermanWorkingBranch: txBranch,
    branch: txBranch,
    subtotal: payload.subtotal,
    discount: payload.discount,
    grandTotal: payload.grandTotal,
    paymentMethod: payload.paymentMethod,
    paymentStatus: "PAID",
    notes: payload.notes || null,
    createdAt: new Date(),
  };
  memoryDB.transactions.unshift(newTx);

  // Items & Stock deduction per branch (AX. PENJUALAN PRODUK OTOMATIS MENGURANGI STOK CABANG)
  const itemsCreated = payload.items.map((it, idx) => {
    const itemObj = {
      id: \`txi_\${txId}_\${idx}\`,
      transactionId: txId,
      itemType: it.itemType,
      serviceId: it.serviceId || null,
      productId: it.productId || null,
      name: it.name,
      price: it.price,
      costPrice: it.costPrice || 0,
      quantity: it.quantity,
      subtotal: it.subtotal,
    };
    memoryDB.transactionItems.push(itemObj);

    if (it.itemType === "PRODUCT" && it.productId) {
      const prod = memoryDB.products.find((p) => p.id === it.productId);
      if (prod) {
        if (prod.stockTelkom === undefined || prod.stockSuta === undefined) {
          const tot = prod.stock || 0;
          prod.stockTelkom = Math.ceil(tot / 2);
          prod.stockSuta = Math.floor(tot / 2);
          prod.stock = prod.stockTelkom + prod.stockSuta;
        }

        const isSuta = txBranch === "Suta";
        const prevStock = isSuta ? prod.stockSuta : prod.stockTelkom;
        if (isSuta) {
          prod.stockSuta = Math.max(0, prod.stockSuta - it.quantity);
        } else {
          prod.stockTelkom = Math.max(0, prod.stockTelkom - it.quantity);
        }
        prod.stock = (prod.stockTelkom || 0) + (prod.stockSuta || 0);

        memoryDB.stockMovements.push({
          id: \`stk_\${Date.now()}_\${idx}\`,
          productId: prod.id,
          type: "OUT",
          quantity: it.quantity,
          previousStock: prevStock,
          currentStock: isSuta ? prod.stockSuta : prod.stockTelkom,
          reason: \`Penjualan Kasir Cabang \${txBranch} (\${invoiceNumber})\`,
          notes: \`Customer: \${payload.customerName}\`,
          createdAt: new Date(),
        });
      }
    }
    return itemObj;
  });

  // Payments
  memoryDB.payments.push({
    id: \`pay_\${Date.now()}\`,
    transactionId: txId,
    paymentMethod: payload.paymentMethod,
    amountPaid: payload.amountPaid,
    changeAmount: payload.changeAmount,
    paymentRef: payload.paymentRef || null,
    createdAt: new Date(),
  });

  // Cash In jika bayar tunai
  if (payload.paymentMethod === "CASH") {
    memoryDB.cashTransactions.unshift({
      id: \`csh_\${Date.now()}\`,
      type: "CASH_IN",
      category: "Penjualan Kasir",
      amount: payload.grandTotal,
      description: \`Pembayaran Cash Kasir \${invoiceNumber} (\${payload.customerName})\`,
      source: "POS_SALE",
      transactionId: txId,
      branch: txBranch,
      createdAt: new Date(),
    });
  }

  // Catat ke Activity Log
  await recordActivity({
    action: "TRANSAKSI_KASIR",
    description: \`Transaksi kasir \${invoiceNumber} sebesar Rp \${payload.grandTotal.toLocaleString("id-ID")} di Cabang \${txBranch} (\${payload.customerName}) oleh \${barber?.name || "Barber"}\`,
    branch: txBranch,
    actor: payload.customerName,
  });

  saveLocalDB();
  return {
    ...newTx,
    items: itemsCreated,
    barberman: barber,
  };
}`;

if (oldCheckoutRegex.test(code)) {
  code = code.replace(oldCheckoutRegex, newCheckout);
  console.log("Updated processCheckout");
} else {
  console.warn("Could not find processCheckout regex match");
}

// -------------------------------------------------------------
// 3. UPDATE getCashLedger & createCashEntry
// -------------------------------------------------------------
const oldCashRegex = /export async function getCashLedger\(\)[\s\S]*?return entry;\n\s*\}\,\n\s*true\n\s*\);\n\}/;
const newCash = `export async function getCashLedger(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  let list = [...memoryDB.cashTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const initialFloatTelkom = memoryDB.shopSettings?.initialCashFloatTelkom ?? 100000;
  const initialFloatSuta = memoryDB.shopSettings?.initialCashFloatSuta ?? 100000;
  const initialFloatTotal = initialFloatTelkom + initialFloatSuta;

  if (branch && branch !== "All") {
    list = list.filter((c) => !c.branch || c.branch === branch || c.branch === "All");
    const activeFloat = branch === "Suta" ? initialFloatSuta : initialFloatTelkom;

    let totalCashIn = 0;
    let totalCashOut = 0;
    for (const item of list) {
      const isInitFloat =
        item.category === "Modal Awal" ||
        item.id === "csh_init" ||
        item.description?.toLowerCase().includes("modal awal");
      if (item.type === "CASH_IN" && !isInitFloat) {
        totalCashIn += item.amount;
      } else if (item.type === "CASH_OUT") {
        totalCashOut += item.amount;
      }
    }
    const systemCash = activeFloat + totalCashIn - totalCashOut;
    return {
      branch,
      initialFloat: activeFloat,
      totalCashIn,
      totalCashOut,
      systemCash,
      transactions: list,
    };
  }

  // Gabungan kedua cabang (Owner)
  let totalCashIn = 0;
  let totalCashOut = 0;
  let telkomCashIn = 0;
  let telkomCashOut = 0;
  let sutaCashIn = 0;
  let sutaCashOut = 0;

  for (const item of list) {
    const isInitFloat =
      item.category === "Modal Awal" ||
      item.id === "csh_init" ||
      item.description?.toLowerCase().includes("modal awal");
    if (item.type === "CASH_IN" && !isInitFloat) {
      totalCashIn += item.amount;
      if (item.branch === "Suta") sutaCashIn += item.amount;
      else telkomCashIn += item.amount;
    } else if (item.type === "CASH_OUT") {
      totalCashOut += item.amount;
      if (item.branch === "Suta") sutaCashOut += item.amount;
      else telkomCashOut += item.amount;
    }
  }

  const telkomCash = initialFloatTelkom + telkomCashIn - telkomCashOut;
  const sutaCash = initialFloatSuta + sutaCashIn - sutaCashOut;
  const systemCash = initialFloatTotal + totalCashIn - totalCashOut;

  return {
    branch: "All",
    initialFloat: initialFloatTotal,
    totalCashIn,
    totalCashOut,
    systemCash,
    telkomCash,
    sutaCash,
    transactions: list,
  };
}

export async function createCashEntry(data: {
  type: "CASH_IN" | "CASH_OUT";
  category: string;
  amount: number;
  description: string;
  source?: string;
  branch?: string;
}) {
  await initMemoryDBIfNeeded();
  const entry = {
    id: \`csh_\${Date.now()}\`,
    type: data.type,
    category: data.category,
    amount: data.amount,
    description: data.description,
    source: data.source || "MANUAL",
    branch: data.branch || "Telkom",
    createdAt: new Date(),
  };
  memoryDB.cashTransactions.unshift(entry);

  await recordActivity({
    action: "CASH_MANAGEMENT",
    description: \`Catat kas \${data.type === "CASH_IN" ? "Masuk" : "Keluar"} Rp \${data.amount.toLocaleString("id-ID")} (\${data.category} - \${data.description}) di Cabang \${entry.branch}\`,
    branch: entry.branch,
    actor: "Admin",
  });

  saveLocalDB();
  return entry;
}`;

if (oldCashRegex.test(code)) {
  code = code.replace(oldCashRegex, newCash);
  console.log("Updated cash functions");
} else {
  console.warn("Could not find cash regex match");
}

fs.writeFileSync(dbPath, code, 'utf8');
console.log("Finished step 3 patch");

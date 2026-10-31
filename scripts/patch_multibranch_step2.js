const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lib', 'db.ts');
let code = fs.readFileSync(dbPath, 'utf8');

// -------------------------------------------------------------
// 1. UPDATE getBarbermen
// -------------------------------------------------------------
const oldGetBarbermenRegex = /export async function getBarbermen\([\s\S]*?\n\}/;
const newGetBarbermen = `export async function getBarbermen(includeInactive = false, workingBranch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  return safeDb(
    async () => {
      const dbList = await prisma.barberman.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { name: "asc" },
      });
      return dbList.map((b: any) => {
        const sutaNames = ["ade", "arif", "akmal"];
        const isSutaDefault = sutaNames.some((n) => (b.name || "").toLowerCase().includes(n));
        const homeBranch = b.homeBranch || (isSutaDefault ? "Suta" : "Telkom");
        const currentWorking = b.workingBranch || b.branch || homeBranch;
        const isActive = b.isActive !== false;
        let status = "AKTIF";
        if (!isActive) status = "LIBUR";
        else if (currentWorking !== homeBranch) status = "DIPERBANTUKAN";

        return {
          ...b,
          homeBranch,
          workingBranch: currentWorking,
          branch: currentWorking,
          isActive,
          status,
        };
      });
    },
    () => {
      let list = memoryDB.barbermen.map((b: any) => {
        const sutaNames = ["ade", "arif", "akmal"];
        const isSutaDefault = sutaNames.some((n) => (b.name || "").toLowerCase().includes(n));
        const homeBranch = b.homeBranch || (isSutaDefault ? "Suta" : "Telkom");
        const currentWorking = b.workingBranch || b.branch || homeBranch;
        const isActive = b.isActive !== false;
        let status = "AKTIF";
        if (!isActive) status = "LIBUR";
        else if (currentWorking !== homeBranch) status = "DIPERBANTUKAN";

        return {
          ...b,
          homeBranch,
          workingBranch: currentWorking,
          branch: currentWorking,
          isActive,
          status,
        };
      });

      if (!includeInactive) {
        list = list.filter((b) => b.isActive);
      }

      if (workingBranch && workingBranch !== "All") {
        list = list.filter((b) => b.workingBranch === workingBranch);
      }

      return list;
    }
  );
}`;

if (oldGetBarbermenRegex.test(code)) {
  code = code.replace(oldGetBarbermenRegex, newGetBarbermen);
  console.log("Updated getBarbermen");
} else {
  console.warn("Could not find getBarbermen regex match");
}

// -------------------------------------------------------------
// 2. UPDATE getProductTransfers & createProductTransfer
// -------------------------------------------------------------
const oldTransfersRegex = /export async function getProductTransfers\(\)[\s\S]*?return transferRecord;\n\}/;
const newTransfers = `export async function getProductTransfers(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  let list = (memoryDB.transfers || []).sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (branch && branch !== "All") {
    list = list.filter(
      (t: any) =>
        (t.fromBranch && t.fromBranch.toLowerCase().includes(branch.toLowerCase())) ||
        (t.toBranch && t.toBranch.toLowerCase().includes(branch.toLowerCase()))
    );
  }
  return list;
}

export async function createProductTransfer(input: CreateTransferInput) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const product = memoryDB.products.find((p) => p.id === input.productId);
  if (!product) throw new Error("Produk tidak ditemukan");

  const qty = Number(input.quantity);
  if (isNaN(qty) || qty <= 0) throw new Error("Jumlah transfer harus lebih dari 0");

  const tlkFrom = input.fromBranch.toLowerCase().includes("telkom");
  const isFromSuta = input.fromBranch.toLowerCase().includes("suta");

  // Pastikan stok cabang pengirim terhitung dengan akurat
  if (product.stockTelkom === undefined || product.stockSuta === undefined) {
    const tot = product.stock || 0;
    product.stockTelkom = Math.ceil(tot / 2);
    product.stockSuta = Math.floor(tot / 2);
    product.stock = product.stockTelkom + product.stockSuta;
  }

  const senderStock = tlkFrom ? product.stockTelkom : product.stockSuta;

  // Z. VALIDASI TRANSFER: Tolak jika stok tidak mencukupi
  if (senderStock < qty) {
    throw new Error(\`Stok tidak mencukupi. Stok tersedia: \${senderStock}.\`);
  }

  // AA. ATOMIC TRANSFER: Pengirim berkurang, penerima bertambah serentak
  if (tlkFrom) {
    product.stockTelkom = Math.max(0, product.stockTelkom - qty);
    product.stockSuta = (product.stockSuta || 0) + qty;
  } else {
    product.stockSuta = Math.max(0, product.stockSuta - qty);
    product.stockTelkom = (product.stockTelkom || 0) + qty;
  }
  product.stock = (product.stockTelkom || 0) + (product.stockSuta || 0);

  const todayStr = format(new Date(), "yyyyMMdd");
  const codeFrom = tlkFrom ? "TLK" : "SUT";
  const codeTo = tlkFrom ? "SUT" : "TLK";
  const count = (memoryDB.transfers?.length || 0) + 1;
  const transferNumber = \`TRF-\${codeFrom}-\${codeTo}-\${todayStr}-\${String(count).padStart(3, "0")}\`;

  const category = memoryDB.categories.find((c) => c.id === product.categoryId);

  const transferRecord = {
    id: \`trf_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
    transferNumber,
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    categoryName: category?.name || "Produk",
    fromBranch: input.fromBranch,
    toBranch: input.toBranch,
    quantity: qty,
    unit: product.unit || "pcs",
    notes: input.notes || "Transfer stok operasional cabang",
    createdBy: input.createdBy || "Admin",
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    stockTelkomAfter: product.stockTelkom,
    stockSutaAfter: product.stockSuta,
  };

  if (!memoryDB.transfers) {
    memoryDB.transfers = [];
  }
  memoryDB.transfers.unshift(transferRecord);

  // Catat ke movement log
  memoryDB.stockMovements.push({
    id: \`stk_trf_out_\${Date.now()}\`,
    productId: product.id,
    type: "OUT" as const,
    quantity: qty,
    previousStock: senderStock,
    currentStock: tlkFrom ? product.stockTelkom : product.stockSuta,
    reason: \`Transfer Keluar: \${input.fromBranch} → \${input.toBranch} (\${transferNumber})\`,
    notes: input.notes || "",
    createdAt: new Date(),
  });

  // Catat Activity Log
  await recordActivity({
    action: "TRANSFER_PRODUK",
    description: \`Transfer \${qty} \${product.unit || "pcs"} \${product.name} dari \${input.fromBranch} ke \${input.toBranch} (\${transferNumber})\`,
    branch: tlkFrom ? "Telkom" : "Suta",
    actor: input.createdBy || "Admin",
  });

  saveLocalDB();
  return transferRecord;
}`;

if (oldTransfersRegex.test(code)) {
  code = code.replace(oldTransfersRegex, newTransfers);
  console.log("Updated transfers functions");
} else {
  console.warn("Could not find transfers regex match");
}

fs.writeFileSync(dbPath, code, 'utf8');
console.log("Finished step 2 patch");

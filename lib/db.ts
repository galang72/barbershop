import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { format, subDays } from "date-fns";
import fs from "fs";
import path from "path";

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
export interface InMemoryDB {
  initialized: boolean;
  users: any[];
  barbermen: any[];
  services: any[];
  categories: any[];
  products: any[];
  stockMovements: any[];
  customers: any[];
  members: any[];
  bookings: any[];
  transactions: any[];
  transactionItems: any[];
  payments: any[];
  cashTransactions: any[];
  expenses: any[];
  transfers: any[];
  branchReports: any[];
  activities: any[];
  barberAssignments: any[];
  shopSettings: any;
}

const globalForDB = globalThis as unknown as {
  __ad_barbershop_memory_db?: InMemoryDB;
  __ad_barbershop_mtime?: number;
};

if (!globalForDB.__ad_barbershop_memory_db) {
  globalForDB.__ad_barbershop_memory_db = {
    initialized: false,
    users: [],
    barbermen: [],
    services: [],
    categories: [],
    products: [],
    stockMovements: [],
    customers: [],
    members: [],
    bookings: [],
    transactions: [],
    transactionItems: [],
    payments: [],
    cashTransactions: [],
    expenses: [],
    transfers: [],
    branchReports: [],
    activities: [],
    barberAssignments: [],
    shopSettings: {
      id: "default",
      shopName: "AD BARBERSHOP",
      address: "Jl. Telekomunikasi No.234, Lengkong, Kec. Bojongsoang, Kabupaten Bandung, Jawa Barat 40287",
      phone: "0895-3267-09996",
      receiptHeader: "Classic Haircut & Professional Grooming",
      receiptFooter: "Terima Kasih Atas Kunjungan Anda!",
      initialCashFloat: 100000,
      initialCashFloatTelkom: 100000,
      initialCashFloatSuta: 100000,
      bookingQrUrl: "/qris-ad-barbershop.png",
    },
  };
}

export const memoryDB: InMemoryDB = globalForDB.__ad_barbershop_memory_db;

// ==========================================
// 2. HELPER UTILS & FILE STORAGE
// ==========================================
export function getDbFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "ad-barbershop-db.json");
  }
  return path.join(process.cwd(), "data", "local-db.json");
}

export function saveLocalDB() {
  try {
    const filePath = getDbFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(memoryDB, null, 2), "utf-8");
    if (fs.existsSync(filePath)) {
      globalForDB.__ad_barbershop_mtime = fs.statSync(filePath).mtimeMs;
    }
  } catch (err: any) {
    console.warn("⚠️ saveLocalDB error:", err?.message);
  }
}

export function loadLocalDB(): boolean {
  try {
    const filePath = getDbFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.initialized) {
        Object.assign(memoryDB, parsed);
        ensureRolesAndTransfers(memoryDB);
        globalForDB.__ad_barbershop_mtime = fs.statSync(filePath).mtimeMs;
        return true;
      }
    }
  } catch {}
  return false;
}

export function syncFromLocalDB(): void {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) return;
  loadLocalDB();
}

export function ensureRolesAndTransfers(db: InMemoryDB) {
  if (!db.transfers) db.transfers = [];
  if (!db.branchReports) db.branchReports = [];
  if (!db.activities) db.activities = [];
  if (!db.barberAssignments) db.barberAssignments = [];
  if (!db.cashTransactions) db.cashTransactions = [];
  if (!db.members) db.members = [];
  if (!db.shopSettings) db.shopSettings = {};
}

export function initMemoryDBIfNeeded() {
  if (!memoryDB.initialized) {
    const loaded = loadLocalDB();
    if (!loaded) {
      seedMemoryData(true);
    }
  }
}

// ==========================================
// 3. SEEDING & DATABASE SCHEMA
// ==========================================
export async function seedMemoryData(includeTransactions: boolean = true) {
  const passwordHash = "$2a$10$cS0SEMAI7ePLiuHs/VlGv.H0weDyjirNgwDGA16tWZewUErJADc7i"; // admin123
  memoryDB.users = [
    { id: "usr_owner", username: "owner", email: "owner@adbarbershop.com", passwordHash, name: "Owner AD Barbershop", role: "OWNER", branch: "All" },
    { id: "usr_admin_telkom", username: "admin_telkom", email: "telkom@adbarbershop.com", passwordHash, name: "Admin Telkom", role: "ADMIN_TELKOM", branch: "Telkom" },
    { id: "usr_admin_suta", username: "admin_suta", email: "suta@adbarbershop.com", passwordHash, name: "Admin Suta", role: "ADMIN_SUTA", branch: "Suta" },
  ];

  memoryDB.barbermen = [
    { id: "brb_ari", name: "Ari", nickname: "Bang Ari", phone: "081200004444", isActive: true, branch: "Telkom" },
    { id: "brb_dani", name: "Dani", nickname: "Bang Dani", phone: "081255556666", isActive: true, branch: "Telkom" },
    { id: "brb_azis", name: "Azis", nickname: "Bang Azis", phone: "081233334444", isActive: true, branch: "Telkom" },
    { id: "brb_ade", name: "Ade", nickname: "Bang Ade", phone: "081200001111", isActive: true, branch: "Suta" },
    { id: "brb_arif", name: "Arif", nickname: "Bang Arif", phone: "081200002222", isActive: true, branch: "Suta" },
    { id: "brb_akmal", name: "Akmal", nickname: "Bang Akmal", phone: "081200003333", isActive: true, branch: "Suta" },
  ];

  memoryDB.services = [
    { id: "srv_haircut_classic", name: "Classic Haircut", category: "HAIRCUT", price: 40000, durationMinutes: 30, isActive: true },
    { id: "srv_haircut_premium", name: "Premium Haircut", category: "HAIRCUT", price: 60000, durationMinutes: 45, isActive: true },
  ];

  memoryDB.categories = [
    { id: "cat_pomade", name: "Pomade", slug: "pomade", description: "Minyak rambut styling" },
  ];

  memoryDB.products = [
    { id: "prd_pomade_01", categoryId: "cat_pomade", sku: "POM-01", name: "Suavecito Pomade", costPrice: 85000, sellingPrice: 130000, stock: 20, stockTelkom: 10, stockSuta: 10, minStock: 5, unit: "pot", isActive: true },
  ];

  memoryDB.customers = [
    { id: "cst_01", name: "Budi", phone: "08123456789", branch: "Telkom", totalVisits: 1, totalSpend: 40000, favoriteBarbermanId: "brb_ari", createdAt: new Date() },
  ];

  memoryDB.bookings = [];
  memoryDB.transactions = [];
  memoryDB.transactionItems = [];
  memoryDB.initialized = true;
  saveLocalDB();
}

export async function ensureSupabaseSchema(): Promise<void> {
  initMemoryDBIfNeeded();
}

// ==========================================
// 4. EXPORTED API QUERY FUNCTIONS
// ==========================================

// Activities & Audit
export async function getActivities(branch?: string) {
  initMemoryDBIfNeeded();
  let list = memoryDB.activities || [];
  if (branch && branch !== "All") {
    list = list.filter((a) => a.branch === branch || a.branch === "All");
  }
  return list;
}

export async function logActivity(action: string, details: string, user: string, branch: string = "All") {
  initMemoryDBIfNeeded();
  const act = { id: `act_${Date.now()}`, action, details, user, branch, createdAt: new Date().toISOString() };
  memoryDB.activities.unshift(act);
  saveLocalDB();
  return act;
}

// Admin / User Management
export async function findAdminUser(username: string) {
  initMemoryDBIfNeeded();
  return memoryDB.users.find((u) => u.username?.toLowerCase() === username.toLowerCase());
}

export async function updateAdminPassword(username: string, newHash: string) {
  initMemoryDBIfNeeded();
  const user = memoryDB.users.find((u) => u.username?.toLowerCase() === username.toLowerCase());
  if (user) {
    user.passwordHash = newHash;
    saveLocalDB();
    return true;
  }
  return false;
}

// Barbermen & Assignments
export async function getBarbermen(branch?: string) {
  initMemoryDBIfNeeded();
  let list = memoryDB.barbermen || [];
  if (branch && branch !== "All") {
    list = list.filter((b) => b.branch === branch || b.workingBranch === branch);
  }
  return list;
}

export async function createBarberman(data: any) {
  initMemoryDBIfNeeded();
  const newBarber = { id: `brb_${Date.now()}`, ...data, isActive: true };
  memoryDB.barbermen.push(newBarber);
  saveLocalDB();
  return newBarber;
}

export async function deleteBarberman(id: string) {
  initMemoryDBIfNeeded();
  memoryDB.barbermen = memoryDB.barbermen.filter((b) => b.id !== id);
  saveLocalDB();
  return true;
}

export async function getBarberAssignments() {
  initMemoryDBIfNeeded();
  return memoryDB.barberAssignments || [];
}

export async function assignBarberman(barbermanId: string, targetBranch: string) {
  initMemoryDBIfNeeded();
  const barber = memoryDB.barbermen.find((b) => b.id === barbermanId);
  if (barber) {
    barber.workingBranch = targetBranch;
    barber.branch = targetBranch;
    saveLocalDB();
  }
  return barber;
}

// Bookings
export async function getBookings(branch?: string) {
  initMemoryDBIfNeeded();
  let list = memoryDB.bookings || [];
  if (branch && branch !== "All") {
    list = list.filter((b) => b.branch === branch);
  }
  return list;
}

export async function createBooking(data: any) {
  initMemoryDBIfNeeded();
  const newBooking = { id: `bkg_${Date.now()}`, ...data, createdAt: new Date() };
  memoryDB.bookings.push(newBooking);
  saveLocalDB();
  return newBooking;
}

export async function updateBookingStatus(id: string, status: string) {
  initMemoryDBIfNeeded();
  const booking = memoryDB.bookings.find((b) => b.id === id);
  if (booking) {
    booking.status = status;
    saveLocalDB();
  }
  return booking;
}

// Cash Ledger & Shop Settings
export async function getCashLedger(branch?: string) {
  initMemoryDBIfNeeded();
  let list = memoryDB.cashTransactions || [];
  if (branch && branch !== "All") {
    list = list.filter((c) => c.branch === branch || c.branch === "All");
  }
  return list;
}

export async function createCashEntry(data: any) {
  initMemoryDBIfNeeded();
  const entry = { id: `cash_${Date.now()}`, ...data, createdAt: new Date() };
  memoryDB.cashTransactions.push(entry);
  saveLocalDB();
  return entry;
}

export async function getShopSettings() {
  initMemoryDBIfNeeded();
  return memoryDB.shopSettings;
}

export async function updateShopSettings(data: any) {
  initMemoryDBIfNeeded();
  memoryDB.shopSettings = { ...memoryDB.shopSettings, ...data };
  saveLocalDB();
  return memoryDB.shopSettings;
}

// Customers & Members
export async function getCustomers(branch?: string) {
  initMemoryDBIfNeeded();
  let list = memoryDB.customers || [];
  if (branch && branch !== "All") {
    list = list.filter((c) => c.branch === branch);
  }
  return list;
}

export async function getCustomerDetail(id: string) {
  initMemoryDBIfNeeded();
  return memoryDB.customers.find((c) => c.id === id);
}

export async function createCustomer(data: any) {
  initMemoryDBIfNeeded();
  const newCst = { id: `cst_${Date.now()}`, totalVisits: 0, totalSpend: 0, ...data, createdAt: new Date() };
  memoryDB.customers.push(newCst);
  saveLocalDB();
  return newCst;
}

export async function updateCustomer(id: string, data: any) {
  initMemoryDBIfNeeded();
  const idx = memoryDB.customers.findIndex((c) => c.id === id);
  if (idx !== -1) {
    memoryDB.customers[idx] = { ...memoryDB.customers[idx], ...data };
    saveLocalDB();
    return memoryDB.customers[idx];
  }
  return null;
}

export async function deleteCustomer(id: string) {
  initMemoryDBIfNeeded();
  memoryDB.customers = memoryDB.customers.filter((c) => c.id !== id);
  saveLocalDB();
  return true;
}

export async function getMembers() {
  initMemoryDBIfNeeded();
  return memoryDB.members || [];
}

export async function createMember(data: any) {
  initMemoryDBIfNeeded();
  const member = { id: `mbr_${Date.now()}`, ...data, createdAt: new Date() };
  memoryDB.members.push(member);
  saveLocalDB();
  return member;
}

export async function extendMember(id: string, days: number) {
  initMemoryDBIfNeeded();
  const mbr = memoryDB.members.find((m) => m.id === id);
  if (mbr) {
    const cur = new Date(mbr.expiresAt || Date.now());
    cur.setDate(cur.getDate() + days);
    mbr.expiresAt = cur;
    saveLocalDB();
  }
  return mbr;
}

export async function deleteMember(id: string) {
  initMemoryDBIfNeeded();
  memoryDB.members = memoryDB.members.filter((m) => m.id !== id);
  saveLocalDB();
  return true;
}

// Products & Stock Transfers
export async function getProducts() {
  initMemoryDBIfNeeded();
  return memoryDB.products || [];
}

export async function getProductCategories() {
  initMemoryDBIfNeeded();
  return memoryDB.categories || [];
}

export async function createProduct(data: any) {
  initMemoryDBIfNeeded();
  const prd = { id: `prd_${Date.now()}`, ...data, isActive: true };
  memoryDB.products.push(prd);
  saveLocalDB();
  return prd;
}

export async function updateProduct(id: string, data: any) {
  initMemoryDBIfNeeded();
  const idx = memoryDB.products.findIndex((p) => p.id === id);
  if (idx !== -1) {
    memoryDB.products[idx] = { ...memoryDB.products[idx], ...data };
    saveLocalDB();
    return memoryDB.products[idx];
  }
  return null;
}

export async function adjustStock(productId: string, qty: number, branch: string) {
  initMemoryDBIfNeeded();
  const prd = memoryDB.products.find((p) => p.id === productId);
  if (prd) {
    if (branch === "Suta") prd.stockSuta = (prd.stockSuta || 0) + qty;
    else prd.stockTelkom = (prd.stockTelkom || 0) + qty;
    prd.stock = (prd.stockTelkom || 0) + (prd.stockSuta || 0);
    saveLocalDB();
  }
  return prd;
}

export async function getProductTransfers() {
  initMemoryDBIfNeeded();
  return memoryDB.transfers || [];
}

export async function createProductTransfer(data: any) {
  initMemoryDBIfNeeded();
  const trf = { id: `trf_${Date.now()}`, ...data, createdAt: new Date() };
  memoryDB.transfers.push(trf);
  saveLocalDB();
  return trf;
}

// Services
export async function getServices() {
  initMemoryDBIfNeeded();
  return memoryDB.services || [];
}

export async function createService(data: any) {
  initMemoryDBIfNeeded();
  const srv = { id: `srv_${Date.now()}`, ...data, isActive: true };
  memoryDB.services.push(srv);
  saveLocalDB();
  return srv;
}

export async function updateService(id: string, data: any) {
  initMemoryDBIfNeeded();
  const idx = memoryDB.services.findIndex((s) => s.id === id);
  if (idx !== -1) {
    memoryDB.services[idx] = { ...memoryDB.services[idx], ...data };
    saveLocalDB();
    return memoryDB.services[idx];
  }
  return null;
}

export async function deleteService(id: string) {
  initMemoryDBIfNeeded();
  memoryDB.services = memoryDB.services.filter((s) => s.id !== id);
  saveLocalDB();
  return true;
}

// Transactions & Checkout
export async function getTransactions(branch?: string) {
  initMemoryDBIfNeeded();
  let list = memoryDB.transactions || [];
  if (branch && branch !== "All") {
    list = list.filter((t) => t.branch === branch);
  }
  return list;
}

export async function processCheckout(data: any) {
  initMemoryDBIfNeeded();
  const txId = `tx_${Date.now()}`;
  const newTx = {
    id: txId,
    invoiceNumber: `AD-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`,
    ...data,
    createdAt: new Date(),
  };

  memoryDB.transactions.push(newTx);

  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      memoryDB.transactionItems.push({
        id: `txi_${Date.now()}_${Math.random()}`,
        transactionId: txId,
        ...item,
      });
    }
  }

  saveLocalDB();
  return newTx;
}

// Reports & Diagnostics
export async function getDailyReport(dateStr?: string, branch?: string) {
  initMemoryDBIfNeeded();
  const txs = await getTransactions(branch);
  const totalRevenue = txs.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
  return { totalRevenue, totalTransactions: txs.length, transactions: txs };
}

export async function getMonthlyReport(monthStr?: string, branch?: string) {
  return getDailyReport(monthStr, branch);
}

export async function getAnnualReport(yearStr?: string, branch?: string) {
  return getDailyReport(yearStr, branch);
}

export async function getCategoryReport(branch?: string) {
  initMemoryDBIfNeeded();
  return [];
}

export async function getDashboardData(branch?: string) {
  initMemoryDBIfNeeded();
  const txs = await getTransactions(branch);
  const totalRevenue = txs.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
  return {
    todayRevenue: totalRevenue,
    todayTransactions: txs.length,
    activeBarbermen: memoryDB.barbermen.length,
    totalCustomers: memoryDB.customers.length,
    recentTransactions: txs.slice(-5),
  };
}

export async function getDatabaseDiagnostics() {
  initMemoryDBIfNeeded();
  return {
    status: "ok",
    type: "in-memory-file",
    counts: {
      users: memoryDB.users.length,
      barbermen: memoryDB.barbermen.length,
      customers: memoryDB.customers.length,
      transactions: memoryDB.transactions.length,
    },
  };
}

export async function resetDatabase() {
  await seedMemoryData(false);
  return true;
}
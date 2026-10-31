/**
 * CLEAN DATABASE SCRIPT
 * Menghapus semua data transaksi, customer, member, aktivitas yang di-seed
 * Mempertahankan: users, barbermen, services, categories, products, shopSettings
 */
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/local-db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

console.log('\n=== MEMBERSIHKAN DATABASE ===');
console.log('Data sebelum pembersihan:');
console.log('  customers:', db.customers?.length || 0);
console.log('  members:', db.members?.length || 0);
console.log('  transactions:', db.transactions?.length || 0);
console.log('  transactionItems:', db.transactionItems?.length || 0);
console.log('  payments:', db.payments?.length || 0);
console.log('  cashTransactions:', db.cashTransactions?.length || 0);
console.log('  activities:', db.activities?.length || 0);
console.log('  bookings:', db.bookings?.length || 0);
console.log('  barberAssignments:', db.barberAssignments?.length || 0);
console.log('  transfers:', db.transfers?.length || 0);
console.log('  stockMovements:', db.stockMovements?.length || 0);
console.log('  branchReports:', db.branchReports?.length || 0);

// Bersihkan semua data operasional, pertahankan master data
db.customers = [];
db.members = [];
db.transactions = [];
db.transactionItems = [];
db.payments = [];
db.cashTransactions = [];
db.activities = [];
db.bookings = [];
db.barberAssignments = [];
db.transfers = [];
db.stockMovements = [];
db.branchReports = db.branchReports || [];

// Pastikan shopSettings ada dan benar
if (!db.shopSettings) {
  db.shopSettings = {};
}
db.shopSettings.initialCashFloatTelkom = db.shopSettings.initialCashFloatTelkom || 100000;
db.shopSettings.initialCashFloatSuta = db.shopSettings.initialCashFloatSuta || 100000;
db.shopSettings.initialCashFloat = db.shopSettings.initialCashFloat || 100000;

// Pastikan setiap barber punya field yang benar
db.barbermen = (db.barbermen || []).map(b => ({
  ...b,
  homeBranch: b.homeBranch || b.branch,
  workingBranch: b.workingBranch || b.branch,
  branch: b.branch || b.workingBranch,
  status: b.isActive !== false ? 'AKTIF' : 'LIBUR',
  isActive: b.isActive !== false,
}));

// Tulis kembali
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');

console.log('\nData setelah pembersihan:');
const cleaned = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
console.log('  customers:', cleaned.customers?.length || 0);
console.log('  members:', cleaned.members?.length || 0);
console.log('  transactions:', cleaned.transactions?.length || 0);
console.log('  activities:', cleaned.activities?.length || 0);
console.log('  barbermen:', cleaned.barbermen?.length || 0);
console.log('  services:', cleaned.services?.length || 0);
console.log('  products:', cleaned.products?.length || 0);
console.log('\n✅ Database berhasil dibersihkan!');
console.log('Master data (users, barbermen, services, products, categories) tetap ada.');

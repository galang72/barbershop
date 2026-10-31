const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lib', 'db.ts');
let code = fs.readFileSync(dbPath, 'utf8');

// 1. Tambahkan fungsi Activities & Barber Assignments di akhir file jika belum ada
if (!code.includes('export async function recordActivity')) {
  const newFunctions = `

// -------------------------------------------------------------
// LOG AKTIVITAS (ACTIVITY LOG MULTI-CABANG)
// -------------------------------------------------------------
export async function recordActivity(data: {
  action: string;
  description: string;
  branch?: string;
  actor?: string;
  details?: any;
}) {
  await initMemoryDBIfNeeded();
  const activity = {
    id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    action: data.action,
    description: data.description,
    branch: data.branch || "All",
    actor: data.actor || "Sistem",
    details: data.details || null,
    createdAt: new Date().toISOString(),
  };
  if (!memoryDB.activities) memoryDB.activities = [];
  memoryDB.activities.unshift(activity);
  saveLocalDB();
  return activity;
}

export async function getActivities(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  let list = memoryDB.activities || [];
  if (branch && branch !== "All") {
    list = list.filter((a: any) => a.branch === branch || a.branch === "All");
  }
  return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// -------------------------------------------------------------
// PENUGASAN BARBERMAN (BARBER ASSIGNMENT / DIPERBANTUKAN)
// -------------------------------------------------------------
export async function assignBarberman(data: {
  barbermanId: string;
  targetBranch: string; // "Telkom" | "Suta"
  startDate?: string;
  endDate?: string;
  notes?: string;
  assignedBy?: string;
}) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const barber = memoryDB.barbermen.find((b: any) => b.id === data.barbermanId);
  if (!barber) throw new Error("Barberman tidak ditemukan");

  const sutaNames = ["ade", "arif", "akmal"];
  if (!barber.homeBranch) {
    barber.homeBranch = sutaNames.some((n) => (barber.name || "").toLowerCase().includes(n)) ? "Suta" : "Telkom";
  }

  barber.workingBranch = data.targetBranch;
  barber.branch = data.targetBranch;
  barber.isActive = true;
  barber.status = data.targetBranch === barber.homeBranch ? "AKTIF" : "DIPERBANTUKAN";

  const assignment = {
    id: "asg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    barbermanId: barber.id,
    barbermanName: barber.name,
    homeBranch: barber.homeBranch,
    workingBranch: data.targetBranch,
    startDate: data.startDate || new Date().toISOString().split("T")[0],
    endDate: data.endDate || null,
    notes: data.notes || ("Penugasan " + barber.name + " ke Cabang " + data.targetBranch),
    status: barber.status,
    createdBy: data.assignedBy || "Admin",
    createdAt: new Date().toISOString(),
  };

  if (!memoryDB.barberAssignments) memoryDB.barberAssignments = [];
  memoryDB.barberAssignments.unshift(assignment);

  await recordActivity({
    action: "PENUGASAN_BARBER",
    description: barber.name + " (Cabang asal: " + barber.homeBranch + ") ditugaskan ke Cabang " + data.targetBranch + " (Status: " + barber.status + ")",
    branch: data.targetBranch,
    actor: data.assignedBy || "Admin",
  });

  saveLocalDB();
  return { barber, assignment };
}

export async function getBarberAssignments(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  let list = memoryDB.barberAssignments || [];
  if (branch && branch !== "All") {
    list = list.filter((a: any) => a.workingBranch === branch || a.homeBranch === branch);
  }
  return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
`;
  code += newFunctions;
  console.log("Activity & Barber assignment functions added.");
}

fs.writeFileSync(dbPath, code, 'utf8');
console.log("Successfully patched db.ts step 1");

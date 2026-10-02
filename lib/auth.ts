import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ad-barbershop-super-secure-jwt-key-32-chars-minimum-2026"
);

export const COOKIE_NAME = "ad_admin_session";

export type UserRole = "ADMIN_TELKOM" | "ADMIN_SUTA" | "OWNER" | "ADMIN";
export type BranchName = "Telkom" | "Suta" | "All";

export interface AdminPayload {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  branch?: BranchName;
}

export function getRoleLabel(role?: string): string {
  switch (role) {
    case "ADMIN_TELKOM":
      return "Admin Telkom";
    case "ADMIN_SUTA":
      return "Admin Suta";
    case "OWNER":
      return "Owner AD Barbershop";
    default:
      return "Administrator";
  }
}

export function getBranchLabel(branch?: string): string {
  switch (branch) {
    case "Telkom":
      return "Cabang Telkom";
    case "Suta":
      return "Cabang Suta";
    default:
      return "Semua Cabang (Pusat)";
  }
}

/**
 * Memastikan branch diakses sesuai hak akses role (Backend Authorization):
 * - ADMIN_TELKOM: dipaksa "Telkom" (tidak bisa manipulasi URL / query / body)
 * - ADMIN_SUTA: dipaksa "Suta" (tidak bisa manipulasi URL / query / body)
 * - OWNER: dapat memilih "Telkom", "Suta", atau undefined (semua cabang)
 */
export function resolveBranchFilter(session: AdminPayload | null, requestedBranch?: string | null): string | undefined {
  if (!session) return undefined;
  if (session.role === "ADMIN_TELKOM") return "Telkom";
  if (session.role === "ADMIN_SUTA") return "Suta";
  if (session.role === "OWNER") {
    if (requestedBranch === "Telkom" || requestedBranch === "Suta") return requestedBranch;
    return undefined; // Semua cabang
  }
  return undefined;
}

export function canAccessBranch(session: AdminPayload | null, targetBranch: string): boolean {
  if (!session) return false;
  if (session.role === "OWNER") return true;
  if (session.role === "ADMIN_TELKOM") return targetBranch.toLowerCase().includes("telkom");
  if (session.role === "ADMIN_SUTA") return targetBranch.toLowerCase().includes("suta");
  return false;
}


export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminPayload;
  } catch (err) {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}

export async function setAdminSessionCookie(payload: AdminPayload): Promise<void> {
  const token = await signAdminToken(payload);
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/db";
import { withCache, TTL } from "@/lib/cache";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get("filter") || "today") as any;
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;

    // Backend Authorization: Admin Telkom -> 'Telkom', Admin Suta -> 'Suta', Owner -> searchParam or 'All'
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const cacheKey = `dashboard:${filter}:${start || ""}:${end || ""}:${branch || "all"}`;
    const data = await withCache(cacheKey, () => getDashboardData(filter, start, end, branch), TTL.DASHBOARD);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    });
  } catch (error: any) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { getMonthlyReport } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const month = monthParam ? parseInt(monthParam, 10) - 1 : undefined; // 1-indexed to 0-indexed

    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const data = await getMonthlyReport(year, month, branch);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    console.error("Monthly report API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

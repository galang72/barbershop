import { NextRequest, NextResponse } from "next/server";
import { getDailyReport } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const data = await getDailyReport(date, branch);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

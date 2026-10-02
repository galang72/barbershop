import { NextRequest, NextResponse } from "next/server";
import { getAnnualReport } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : new Date().getFullYear();
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const data = await getAnnualReport(year, branch);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

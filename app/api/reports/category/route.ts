import { NextRequest, NextResponse } from "next/server";
import { getCategoryReport } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "pomade"; // "pomade" or "tonic-powder"
    const filter = searchParams.get("filter") || "month";
    const customStart = searchParams.get("start") || undefined;
    const customEnd = searchParams.get("end") || undefined;
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const now = new Date();
    let startDate = startOfMonth(now);
    let endDate = endOfMonth(now);

    if (filter === "today") {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (filter === "week") {
      startDate = startOfDay(subDays(now, 7));
      endDate = endOfDay(now);
    } else if (filter === "month") {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else if (filter === "year") {
      startDate = startOfYear(now);
      endDate = endOfYear(now);
    } else if (filter === "custom" && customStart && customEnd) {
      startDate = startOfDay(new Date(customStart));
      endDate = endOfDay(new Date(customEnd));
    }

    const slugs = category === "tonic-powder" ? ["tonic", "powder"] : [category];
    const report = await getCategoryReport(slugs, startDate, endDate, branch);

    return NextResponse.json({
      filter,
      branch: branch || "All",
      dateRange: { start: startDate, end: endDate },
      ...report,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

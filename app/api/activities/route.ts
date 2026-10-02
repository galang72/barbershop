import { NextRequest, NextResponse } from "next/server";
import { getActivities } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const activities = await getActivities(branch);
    return NextResponse.json({ activities });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

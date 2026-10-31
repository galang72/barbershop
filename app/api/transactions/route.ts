import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";
import { withCache, TTL } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const branchParam = searchParams.get("branch");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // Resolve branch: admin cannot see other branch, owner can see requested or all
    const branch = resolveBranchFilter(session, branchParam);

    const cacheKey = `transactions:${branch || "all"}:${limit || "all"}`;
    const transactions = await withCache(cacheKey, () => getTransactions(branch, limit), TTL.TRANSACTIONS);

    return NextResponse.json(transactions, {
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

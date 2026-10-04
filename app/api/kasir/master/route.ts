import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBarbermen, getServices, getProducts, getProductCategories } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const branch = session?.branch && session.branch !== "All" ? session.branch : undefined;

    const [barbermen, services, productsRaw, categories, settings] = await Promise.all([
      getBarbermen(false, branch),
      getServices(false),
      getProducts(),
      getProductCategories(),
      prisma.shopSetting.findFirst().catch(() => null),
    ]);

    const products = Array.isArray(productsRaw)
      ? productsRaw
      : (productsRaw as any)?.products || [];

    return NextResponse.json(
      {
        barbermen,
        services,
        products,
        categories,
        shopSettings: settings,
        user: session,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

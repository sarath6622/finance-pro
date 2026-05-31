import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { listHoldingLites } from "@/lib/holdings/lifecycle";
import { buildPortfolioSnapshot } from "@/lib/holdings/valuation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const asOf = sp.get("asOf") ?? undefined;
    await connectMongo();
    const holdings = await listHoldingLites(false);
    const snap = buildPortfolioSnapshot(holdings, asOf ? { asOf } : {});
    // Attach symbol+platform for each holding line so the UI doesn't need a join.
    const labelled = snap.holdings.map((v) => {
      const h = holdings.find((x) => x._id === v.holdingId);
      return {
        ...v,
        symbol: h?.symbol,
        name: h?.name,
        platform: h?.platform,
        assetType: h?.assetType,
        priceCurrency: h?.priceCurrency,
      };
    });
    return NextResponse.json({ ...snap, holdings: labelled }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

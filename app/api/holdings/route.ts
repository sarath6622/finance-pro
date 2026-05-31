import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { HoldingModel } from "@/models";
import {
  createHolding,
  listHoldingLites,
} from "@/lib/holdings/lifecycle";
import { createHoldingInput } from "@/lib/holdings/validate";
import { valueAt } from "@/lib/holdings/valuation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const includeInactive = sp.get("includeInactive") === "true";
    await connectMongo();
    const holdings = await listHoldingLites(includeInactive);
    const enriched = holdings.map((h) => {
      const v = valueAt(h);
      return {
        ...h,
        marketValuePaise: v.marketValuePaise,
        costBasisPaise: v.costBasisPaise,
        unrealizedPnLPaise: v.unrealizedPnLPaise,
        isStalePrice: v.isStalePrice,
        isInvestmentPartial: v.isInvestmentPartial,
      };
    });
    return NextResponse.json({ items: enriched });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = createHoldingInput.parse(await req.json());
    await connectMongo();
    const r = await createHolding(body);
    const doc = await HoldingModel.findById(r._id).lean();
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

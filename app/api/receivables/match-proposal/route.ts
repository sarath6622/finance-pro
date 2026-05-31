import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { proposeMatchForCounterparty } from "@/lib/splits/lifecycle";
import { matchProposalQuery } from "@/lib/splits/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = matchProposalQuery.parse({
      counterpartyId: sp.get("counterpartyId") ?? undefined,
    });
    await connectMongo();
    const match = await proposeMatchForCounterparty(q.counterpartyId);
    return NextResponse.json({ match: match ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}

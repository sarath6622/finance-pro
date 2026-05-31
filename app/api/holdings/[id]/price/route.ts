import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { updatePrice } from "@/lib/holdings/lifecycle";
import { priceUpdateInput } from "@/lib/holdings/validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const body = priceUpdateInput.parse(await req.json());
    await connectMongo();
    const r = await updatePrice(params.id, body);
    return NextResponse.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}

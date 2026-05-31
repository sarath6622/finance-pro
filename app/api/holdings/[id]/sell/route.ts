import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { createSell } from "@/lib/holdings/lifecycle";
import { sellInput } from "@/lib/holdings/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const body = sellInput.parse(await req.json());
    await connectMongo();
    const r = await createSell(params.id, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

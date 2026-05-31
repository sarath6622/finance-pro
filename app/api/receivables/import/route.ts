import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { importExistingReceivable } from "@/lib/receivables/lifecycle";
import { importReceivableInput } from "@/lib/receivables/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = importReceivableInput.parse(await req.json());
    await connectMongo();
    const r = await importExistingReceivable(body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

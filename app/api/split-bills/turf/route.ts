import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { createTurfBill } from "@/lib/splits/lifecycle";
import { turfTemplateInput } from "@/lib/splits/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = turfTemplateInput.parse(await req.json());
    await connectMongo();
    const result = await createTurfBill(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { writeOffParticipant } from "@/lib/splits/lifecycle";
import { writeOffParticipantInput } from "@/lib/splits/validate";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; counterpartyId: string } },
) {
  try {
    await requireSession();
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = writeOffParticipantInput.parse(raw);
    await connectMongo();
    const result = await writeOffParticipant(params.id, params.counterpartyId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

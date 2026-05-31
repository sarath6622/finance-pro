import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { RecurringRuleModel } from "@/models";
import { recurringRuleCreateInput } from "@/lib/recurring/validate";

export const dynamic = "force-dynamic";

function shape(doc: Record<string, unknown>) {
  return {
    _id: String(doc._id),
    label: doc.label,
    accountId: String(doc.accountId),
    counterpartyId: doc.counterpartyId ? String(doc.counterpartyId) : undefined,
    categoryId: doc.categoryId ? String(doc.categoryId) : undefined,
    flowType: doc.flowType,
    amountPaise: doc.amountPaise,
    frequency: doc.frequency,
    dayOfMonth: doc.dayOfMonth,
    startDate: doc.startDate,
    endDate: doc.endDate,
    arrearsPolicy: doc.arrearsPolicy,
    status: doc.status,
    autoGenerate: doc.autoGenerate,
  };
}

export async function GET() {
  try {
    await requireSession();
    await connectMongo();
    const docs = await RecurringRuleModel.find({}).sort({ status: 1, startDate: 1 }).lean();
    return NextResponse.json({ items: docs.map((d) => shape(d as Record<string, unknown>)) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const input = recurringRuleCreateInput.parse(body);
    await connectMongo();
    const created = await RecurringRuleModel.create(input);
    return NextResponse.json(shape(created.toObject()), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { SettingModel } from "@/models";
import { settingsPatchInput } from "@/lib/reports/api-input";

export const dynamic = "force-dynamic";

function shape(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  return {
    liquidityFloorPaise: doc.liquidityFloorPaise,
    reminderTime: doc.reminderTime,
    paydayDayOfMonth: doc.paydayDayOfMonth,
    baseCurrency: doc.baseCurrency,
    payCycleMode: doc.payCycleMode,
    includePassthroughInReports: doc.includePassthroughInReports,
    notifyEnabled: doc.notifyEnabled ?? false,
  };
}

export async function GET() {
  try {
    await requireSession();
    await connectMongo();
    let doc = await SettingModel.findOne({ key: "default" }).lean();
    if (!doc) {
      const created = await SettingModel.create({ key: "default" });
      doc = created.toObject();
    }
    return NextResponse.json(shape(doc));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const patch = settingsPatchInput.parse(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: { code: "validation", message: "empty patch" } }, { status: 400 });
    }
    await connectMongo();
    const updated = await SettingModel.findOneAndUpdate(
      { key: "default" },
      { $set: patch, $setOnInsert: { key: "default" } },
      { upsert: true, new: true },
    ).lean();
    return NextResponse.json(shape(updated));
  } catch (e) {
    return errorResponse(e);
  }
}

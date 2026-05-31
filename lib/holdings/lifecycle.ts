import { Types } from "mongoose";
import { HoldingModel, TransactionModel } from "@/models";
import {
  ApiError,
  conflict,
  notFound,
  validation,
} from "@/lib/http/errors";
import { applyBuy } from "./apply-buy";
import { applySell, SellOverflowError } from "./apply-sell";
import {
  applyCorporateAction,
  CorporateActionError,
} from "./apply-corporate-action";
import {
  applyTransfer,
  mergeTransferredLots,
  TransferError,
} from "./apply-transfer";
import type {
  BuyInputDto,
  CorporateActionInputDto,
  CreateHoldingInput,
  ImportLotInputDto,
  PriceUpdateInputDto,
  SellInputDto,
  TransferInputDto,
} from "./validate";
import type { CorporateActionLog, HoldingLite, LotLite } from "./types";

/* ------------------------------------------------------------------ */
/* doc → lite mapping                                                   */
/* ------------------------------------------------------------------ */

function docToLite(doc: Record<string, unknown>): HoldingLite {
  return {
    _id: String(doc._id),
    assetType: doc.assetType as HoldingLite["assetType"],
    symbol: doc.symbol as string,
    name: doc.name as string,
    platform: doc.platform as string,
    quantity: (doc.quantity ?? 0) as number,
    lots: ((doc.lots as unknown[] | undefined) ?? []).map((l) => {
      const lot = l as Record<string, unknown>;
      return {
        date: lot.date as string,
        quantity: lot.quantity as number,
        unitCostPaise: lot.unitCostPaise as number,
        ...(lot.txnId ? { txnId: String(lot.txnId) } : {}),
      };
    }),
    ...(doc.currentUnitPricePaise !== undefined && doc.currentUnitPricePaise !== null
      ? { currentUnitPricePaise: doc.currentUnitPricePaise as number }
      : {}),
    priceCurrency: (doc.priceCurrency ?? "INR") as HoldingLite["priceCurrency"],
    ...(doc.fxRateToInr ? { fxRateToInr: doc.fxRateToInr as number } : {}),
    ...(doc.fxRateAt
      ? { fxRateAt: new Date(doc.fxRateAt as Date).toISOString() }
      : {}),
    ...(doc.priceUpdatedAt
      ? { priceUpdatedAt: new Date(doc.priceUpdatedAt as Date).toISOString() }
      : {}),
    priceSource: (doc.priceSource ?? "manual") as HoldingLite["priceSource"],
    realizedPnLPaise: (doc.realizedPnLPaise ?? 0) as number,
    isActive: doc.isActive !== false,
  };
}

function liteToDocPatch(lite: HoldingLite): Record<string, unknown> {
  return {
    quantity: lite.quantity,
    lots: lite.lots.map((l) => ({
      date: l.date,
      quantity: l.quantity,
      unitCostPaise: l.unitCostPaise,
      ...(l.txnId ? { txnId: new Types.ObjectId(l.txnId) } : {}),
    })),
    realizedPnLPaise: lite.realizedPnLPaise,
  };
}

/* ------------------------------------------------------------------ */
/* createHolding                                                        */
/* ------------------------------------------------------------------ */

export async function createHolding(input: CreateHoldingInput): Promise<{ _id: string }> {
  const existing = await HoldingModel.findOne({
    symbol: input.symbol,
    platform: input.platform,
    isDeleted: { $ne: true },
  }).lean();
  if (existing) {
    throw conflict(
      `Holding ${input.symbol} on ${input.platform} already exists (id=${String(existing._id)})`,
    );
  }
  const doc = await HoldingModel.create({
    assetType: input.assetType,
    symbol: input.symbol,
    name: input.name,
    platform: input.platform,
    quantity: 0,
    lots: [],
    priceCurrency: input.priceCurrency ?? "INR",
    priceSource: "manual",
    realizedPnLPaise: 0,
    isActive: true,
    ...(input.notes ? { notes: input.notes } : {}),
  });
  return { _id: String(doc._id) };
}

/* ------------------------------------------------------------------ */
/* createBuy: txn + applyBuy                                            */
/* ------------------------------------------------------------------ */

export async function createBuy(
  holdingId: string,
  input: BuyInputDto,
): Promise<{ transactionId: string; holdingId: string; newQuantity: number }> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  if ((doc as { isDeleted?: boolean }).isDeleted) {
    throw conflict("Holding is soft-deleted");
  }
  const lite = docToLite(doc as Record<string, unknown>);

  const totalPaise = Math.round(input.quantity * input.unitCostPaise);
  if (totalPaise <= 0) {
    throw validation("Buy total (quantity × unitCostPaise) must be > 0");
  }

  const txn = await TransactionModel.create({
    valueDate: input.date,
    bookedAt: input.bookedAt ? new Date(input.bookedAt) : new Date(),
    amountPaise: totalPaise,
    direction: "out",
    flowType: "investment",
    accountId: input.payerAccountId,
    holdingId: doc._id,
    description: input.description ?? `Buy ${input.quantity} ${doc.symbol}`,
    ...(input.notes ? { notes: input.notes } : {}),
    source: "manual",
    reviewStatus: "confirmed",
    isDeleted: false,
    editHistory: [],
  });

  try {
    const next = applyBuy(lite, {
      date: input.date,
      quantity: input.quantity,
      unitCostPaise: input.unitCostPaise,
      txnId: String(txn._id),
    });
    await HoldingModel.findByIdAndUpdate(doc._id, { $set: liteToDocPatch(next) });
    return {
      transactionId: String(txn._id),
      holdingId: String(doc._id),
      newQuantity: next.quantity,
    };
  } catch (err) {
    await TransactionModel.findByIdAndDelete(txn._id);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* importLot: add a lot without an offsetting Transaction               */
/* Used to backfill pre-existing positions where the buy happened       */
/* before the user started using this tracker.                          */
/* ------------------------------------------------------------------ */

export async function importLot(
  holdingId: string,
  input: ImportLotInputDto,
): Promise<{ holdingId: string; newQuantity: number }> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  if ((doc as { isDeleted?: boolean }).isDeleted) {
    throw conflict("Holding is soft-deleted");
  }
  const lite = docToLite(doc as Record<string, unknown>);
  const next = applyBuy(lite, {
    date: input.date,
    quantity: input.quantity,
    unitCostPaise: input.unitCostPaise,
  });
  await HoldingModel.findByIdAndUpdate(doc._id, { $set: liteToDocPatch(next) });
  return { holdingId: String(doc._id), newQuantity: next.quantity };
}

/* ------------------------------------------------------------------ */
/* createSell: applySell (may throw overflow) + txn + persist          */
/* ------------------------------------------------------------------ */

export async function createSell(
  holdingId: string,
  input: SellInputDto,
): Promise<{
  transactionId: string;
  holdingId: string;
  newQuantity: number;
  realizedPnLPaise: number;
  totalProceedsPaise: number;
  consumed: Array<{ lotDate: string; qtyConsumed: number; realizedPnLPaise: number }>;
}> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  if ((doc as { isDeleted?: boolean }).isDeleted) {
    throw conflict("Holding is soft-deleted");
  }
  const lite = docToLite(doc as Record<string, unknown>);

  let result;
  try {
    result = applySell(lite, {
      date: input.date,
      quantity: input.quantity,
      unitPricePaise: input.unitPricePaise,
    });
  } catch (err) {
    if (err instanceof SellOverflowError) {
      throw conflict(
        `Cannot sell ${err.requested} — only ${err.available} ${doc.symbol} available`,
        { requested: err.requested, available: err.available },
      );
    }
    throw err;
  }

  const txn = await TransactionModel.create({
    valueDate: input.date,
    bookedAt: input.bookedAt ? new Date(input.bookedAt) : new Date(),
    amountPaise: result.totalProceedsPaise,
    direction: "in",
    flowType: "investment",
    accountId: input.receiverAccountId,
    holdingId: doc._id,
    description: input.description ?? `Sell ${input.quantity} ${doc.symbol}`,
    ...(input.notes ? { notes: input.notes } : {}),
    source: "manual",
    reviewStatus: "confirmed",
    isDeleted: false,
    editHistory: [],
  });

  try {
    await HoldingModel.findByIdAndUpdate(doc._id, {
      $set: liteToDocPatch(result.holding),
    });
    return {
      transactionId: String(txn._id),
      holdingId: String(doc._id),
      newQuantity: result.holding.quantity,
      realizedPnLPaise: result.realizedPnLPaise,
      totalProceedsPaise: result.totalProceedsPaise,
      consumed: result.consumed.map((c) => ({
        lotDate: c.lotDate,
        qtyConsumed: c.qtyConsumed,
        realizedPnLPaise: c.realizedPnLPaise,
      })),
    };
  } catch (err) {
    await TransactionModel.findByIdAndDelete(txn._id);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* recordCorporateAction                                                */
/* ------------------------------------------------------------------ */

export async function recordCorporateAction(
  holdingId: string,
  input: CorporateActionInputDto,
): Promise<{ holdingId: string; newQuantity: number }> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  const lite = docToLite(doc as Record<string, unknown>);
  let next: HoldingLite;
  try {
    next = applyCorporateAction(lite, input);
  } catch (err) {
    if (err instanceof CorporateActionError) {
      throw validation(`corporate action: ${err.code}`);
    }
    throw err;
  }
  const log: CorporateActionLog = {
    at: input.at ?? new Date().toISOString(),
    kind: input.kind,
    ratioNumerator: input.ratioNumerator,
    ratioDenominator: input.ratioDenominator,
    ...(input.notes ? { notes: input.notes } : {}),
  };
  await HoldingModel.findByIdAndUpdate(doc._id, {
    $set: liteToDocPatch(next),
    $push: { corporateActions: { ...log, at: new Date(log.at) } },
  });
  return { holdingId: String(doc._id), newQuantity: next.quantity };
}

/* ------------------------------------------------------------------ */
/* createTransfer: split holding from src into dest (E35)              */
/* ------------------------------------------------------------------ */

export async function createTransfer(
  holdingId: string,
  input: TransferInputDto,
): Promise<{
  sourceHoldingId: string;
  destHoldingId: string;
  movedQuantity: number;
  movedLots: LotLite[];
}> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  const lite = docToLite(doc as Record<string, unknown>);
  let result;
  try {
    result = applyTransfer(lite, {
      date: input.date,
      quantity: input.quantity,
      toPlatform: input.toPlatform,
    });
  } catch (err) {
    if (err instanceof TransferError) {
      if (err.code === "same_platform") {
        throw validation("Transfer must target a different platform");
      }
      throw conflict("Insufficient quantity to transfer");
    }
    throw err;
  }

  // Find or create the destination Holding (same symbol+assetType, different platform).
  let dest = await HoldingModel.findOne({
    symbol: doc.symbol,
    assetType: doc.assetType,
    platform: input.toPlatform,
    isDeleted: { $ne: true },
  });
  if (!dest) {
    dest = await HoldingModel.create({
      assetType: doc.assetType,
      symbol: doc.symbol,
      name: doc.name,
      platform: input.toPlatform,
      quantity: 0,
      lots: [],
      priceCurrency: doc.priceCurrency ?? "INR",
      priceSource: "manual",
      realizedPnLPaise: 0,
      isActive: true,
    });
  }
  const destLite = docToLite(dest.toObject() as Record<string, unknown>);
  const mergedDest = mergeTransferredLots(destLite, result.movedLots, result.movedQuantity);

  await HoldingModel.findByIdAndUpdate(doc._id, { $set: liteToDocPatch(result.from) });
  await HoldingModel.findByIdAndUpdate(dest._id, { $set: liteToDocPatch(mergedDest) });

  return {
    sourceHoldingId: String(doc._id),
    destHoldingId: String(dest._id),
    movedQuantity: result.movedQuantity,
    movedLots: result.movedLots,
  };
}

/* ------------------------------------------------------------------ */
/* updatePrice                                                          */
/* ------------------------------------------------------------------ */

export async function updatePrice(
  holdingId: string,
  input: PriceUpdateInputDto,
): Promise<{ holdingId: string; unitPricePaise: number }> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  const now = new Date();
  const set: Record<string, unknown> = {
    currentUnitPricePaise: input.unitPricePaise,
    priceUpdatedAt: now,
    priceSource: input.source ?? "manual",
  };
  if (input.priceCurrency) set.priceCurrency = input.priceCurrency;
  if (input.fxRateToInr !== undefined) {
    set.fxRateToInr = input.fxRateToInr;
    set.fxRateAt = now;
  }
  await HoldingModel.findByIdAndUpdate(doc._id, { $set: set });
  return { holdingId: String(doc._id), unitPricePaise: input.unitPricePaise };
}

/* ------------------------------------------------------------------ */
/* listHoldings / valueAll                                              */
/* ------------------------------------------------------------------ */

export async function listHoldingLites(includeInactive = false): Promise<HoldingLite[]> {
  const docs = await HoldingModel.find({
    isDeleted: { $ne: true },
    ...(includeInactive ? {} : { isActive: true }),
  }).lean();
  return docs.map((d) => docToLite(d as Record<string, unknown>));
}

export async function getHoldingLite(holdingId: string): Promise<HoldingLite | null> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) return null;
  if ((doc as { isDeleted?: boolean }).isDeleted) return null;
  return docToLite(doc as Record<string, unknown>);
}

/* ------------------------------------------------------------------ */
/* soft-delete                                                          */
/* ------------------------------------------------------------------ */

export async function softDeleteHolding(holdingId: string): Promise<void> {
  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) throw notFound("Holding not found");
  if (((doc.quantity ?? 0) as number) > 0) {
    throw new ApiError(
      "conflict",
      "Cannot delete a holding with quantity > 0 — sell or transfer the position first",
    );
  }
  await HoldingModel.findByIdAndUpdate(doc._id, {
    $set: { isDeleted: true, deletedAt: new Date() },
  });
}

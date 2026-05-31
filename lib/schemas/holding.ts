import { z } from "zod";
import {
  assetType,
  isoDate,
  isoDateTime,
  objectIdString,
  paiseAmount,
  priceCurrency,
  priceSource,
  syncFields,
} from "./common";

export const holdingLotSchema = z.object({
  date: isoDate,
  quantity: z.number().positive(),
  unitCostPaise: paiseAmount,
  txnId: objectIdString.optional(),
});

export const holdingSchema = z
  .object({
    _id: objectIdString.optional(),
    assetType,
    symbol: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    platform: z.string().max(80),
    quantity: z.number().nonnegative(),
    lots: z.array(holdingLotSchema).default([]),
    currentUnitPricePaise: paiseAmount.optional(),
    priceCurrency: priceCurrency.default("INR"),
    fxRateToInr: z.number().positive().optional(),
    fxRateAt: isoDateTime.optional(),
    priceUpdatedAt: isoDateTime.optional(),
    priceSource: priceSource.default("manual"),
    realizedPnLPaise: paiseAmount.default(0),
    isActive: z.boolean().default(true),
  })
  .merge(syncFields);

export type HoldingLot = z.infer<typeof holdingLotSchema>;
export type Holding = z.infer<typeof holdingSchema>;

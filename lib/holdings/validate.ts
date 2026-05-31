import { z } from "zod";
import {
  assetType,
  isoDate,
  isoDateTime,
  objectIdString,
  paiseAmount,
  priceCurrency,
} from "@/lib/schemas/common";

export const createHoldingInput = z.object({
  assetType,
  symbol: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  platform: z.string().min(1).max(80),
  priceCurrency: priceCurrency.default("INR"),
  notes: z.string().max(2000).optional(),
});

export const buyInput = z.object({
  date: isoDate,
  quantity: z.number().positive(),
  unitCostPaise: paiseAmount.refine((n) => n >= 0, "unitCostPaise must be >= 0"),
  payerAccountId: objectIdString,
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  bookedAt: isoDateTime.optional(),
});

export const sellInput = z.object({
  date: isoDate,
  quantity: z.number().positive(),
  unitPricePaise: paiseAmount.refine((n) => n >= 0, "unitPricePaise must be >= 0"),
  receiverAccountId: objectIdString,
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  bookedAt: isoDateTime.optional(),
});

export const corporateActionInput = z.object({
  kind: z.enum(["split", "bonus"]),
  ratioNumerator: z.number().int().min(1),
  ratioDenominator: z.number().int().min(1),
  notes: z.string().max(500).optional(),
  at: isoDateTime.optional(),
});

export const importLotInput = z.object({
  date: isoDate,
  quantity: z.number().positive(),
  unitCostPaise: paiseAmount.refine((n) => n >= 0, "unitCostPaise must be >= 0"),
  notes: z.string().max(2000).optional(),
});

export const transferInput = z.object({
  date: isoDate,
  quantity: z.number().positive(),
  toPlatform: z.string().min(1).max(80),
  notes: z.string().max(2000).optional(),
});

export const priceUpdateInput = z.object({
  unitPricePaise: paiseAmount.refine((n) => n >= 0, "unitPricePaise must be >= 0"),
  priceCurrency: priceCurrency.optional(),
  fxRateToInr: z.number().positive().optional(),
  source: z.enum(["manual", "auto"]).default("manual"),
});

export type CreateHoldingInput = z.infer<typeof createHoldingInput>;
export type BuyInputDto = z.infer<typeof buyInput>;
export type SellInputDto = z.infer<typeof sellInput>;
export type CorporateActionInputDto = z.infer<typeof corporateActionInput>;
export type TransferInputDto = z.infer<typeof transferInput>;
export type PriceUpdateInputDto = z.infer<typeof priceUpdateInput>;
export type ImportLotInputDto = z.infer<typeof importLotInput>;

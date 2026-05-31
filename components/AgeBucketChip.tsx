"use client";

import Chip from "@mui/material/Chip";
import type { AgeBucket } from "@/lib/api/receivables";

export interface AgeBucketChipProps {
  bucket: AgeBucket;
  count?: number;
  size?: "small" | "medium";
}

function colorFor(bucket: AgeBucket): "success" | "warning" | "error" | "default" {
  if (bucket === "0-30") return "success";
  if (bucket === "30-90") return "warning";
  if (bucket === "90+") return "error";
  return "default";
}

function labelFor(bucket: AgeBucket): string {
  if (bucket === "pay-when-able") return "pay-when-able";
  return `${bucket}d`;
}

export function AgeBucketChip({ bucket, count, size = "small" }: AgeBucketChipProps) {
  const label = count === undefined ? labelFor(bucket) : `${labelFor(bucket)} · ${count}`;
  return <Chip size={size} color={colorFor(bucket)} variant="filled" label={label} />;
}

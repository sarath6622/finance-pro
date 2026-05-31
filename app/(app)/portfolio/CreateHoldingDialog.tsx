"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Alert from "@mui/material/Alert";
import { useRouter } from "next/navigation";
import { useCreateHolding, type AssetType, type PriceCurrency } from "@/lib/api/holdings";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateHoldingDialog({ open, onClose }: Props) {
  const create = useCreateHolding();
  const router = useRouter();
  const [assetType, setAssetType] = useState<AssetType>("crypto");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [priceCurrency, setPriceCurrency] = useState<PriceCurrency>("INR");

  useEffect(() => {
    if (!open) {
      create.reset();
      setSymbol("");
      setName("");
      setPlatform("");
      setAssetType("crypto");
      setPriceCurrency("INR");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = symbol.trim() && name.trim() && platform.trim() && !create.isPending;

  async function submit() {
    if (!canSubmit) return;
    const created = await create.mutateAsync({
      assetType,
      symbol: symbol.trim(),
      name: name.trim(),
      platform: platform.trim(),
      priceCurrency,
    });
    onClose();
    router.push(`/portfolio/${created._id}`);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>New holding</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={assetType}
            onChange={(_, v) => v && setAssetType(v as AssetType)}
          >
            <ToggleButton value="crypto">Crypto</ToggleButton>
            <ToggleButton value="stock">Stock</ToggleButton>
            <ToggleButton value="mutual_fund">Mutual fund</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
            inputProps={{ maxLength: 40 }}
            placeholder={assetType === "crypto" ? "BTC, ETH, SOL…" : "TCS, RELIANCE…"}
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            inputProps={{ maxLength: 120 }}
          />
          <TextField
            label="Platform / exchange"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            required
            inputProps={{ maxLength: 80 }}
            placeholder={assetType === "crypto" ? "CoinDCX, Wallet, Ledger…" : "Zerodha, INDmoney…"}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={priceCurrency}
            onChange={(_, v) => v && setPriceCurrency(v as PriceCurrency)}
          >
            <ToggleButton value="INR">Priced in INR</ToggleButton>
            <ToggleButton value="USD">Priced in USD</ToggleButton>
          </ToggleButtonGroup>
          {create.error && (
            <Alert severity="error">{(create.error as Error).message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

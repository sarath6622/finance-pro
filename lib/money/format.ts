export interface FormatOptions {
  withSymbol?: boolean;
  signed?: boolean;
}

export function formatPaise(paise: number, opts: FormatOptions = {}): string {
  const { withSymbol = true, signed = false } = opts;
  const sign = paise < 0 ? "-" : signed && paise > 0 ? "+" : "";
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const paiseRem = abs % 100;
  const grouped = indianGroup(rupees);
  const symbol = withSymbol ? "₹" : "";
  return `${sign}${symbol}${grouped}.${paiseRem.toString().padStart(2, "0")}`;
}

function indianGroup(n: number): string {
  const s = n.toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${groupedRest},${last3}`;
}

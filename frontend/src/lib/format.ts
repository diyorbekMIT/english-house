// Compact UZS display: 333,333 -> "333 ming", 1,500,000 -> "1.5 mln".
// Keeps raw values for anything editable (inputs) — this is for read-only display only.
export const formatUzs = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1_000_000) {
    const mln = abs / 1_000_000;
    const rounded = Math.round(mln * 10) / 10;
    return `${sign}${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} mln`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000)} ming`;
  }
  return `${sign}${abs}`;
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function costRange(min: number, max: number): string {
  if (max === 0) return "Free";
  if (min === max) return usd(min);
  return `${usd(min)} – ${usd(max)}`;
}

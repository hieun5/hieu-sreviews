import { MAX_SPENDING_CENTS } from "@/contracts/journal";

export function usdToCents(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match)
    throw new Error(
      "Use a nonnegative USD amount with up to two decimal places.",
    );
  const cents =
    BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (cents > BigInt(MAX_SPENDING_CENTS))
    throw new Error("That spending amount is too large.");
  return Number(cents);
}

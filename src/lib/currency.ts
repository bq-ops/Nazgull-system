export type Currency = "IQD" | "USD";

export function toDisplayAmount(
  baseAmount: number,
  displayCurrency: Currency,
  baseCurrency: Currency,
  rate: number, // IQD per 1 USD
): number {
  if (displayCurrency === baseCurrency) return baseAmount;
  if (baseCurrency === "IQD" && displayCurrency === "USD") return baseAmount / rate;
  if (baseCurrency === "USD" && displayCurrency === "IQD") return baseAmount * rate;
  return baseAmount;
}

export function toBaseAmount(
  displayAmount: number,
  inputCurrency: Currency,
  baseCurrency: Currency,
  rate: number,
): number {
  if (inputCurrency === baseCurrency) return displayAmount;
  if (inputCurrency === "USD" && baseCurrency === "IQD") return displayAmount * rate;
  if (inputCurrency === "IQD" && baseCurrency === "USD") return displayAmount / rate;
  return displayAmount;
}

export function formatMoney(
  baseAmount: number,
  displayCurrency: Currency,
  baseCurrency: Currency,
  rate: number,
): string {
  const amount = toDisplayAmount(baseAmount, displayCurrency, baseCurrency, rate);
  if (displayCurrency === "IQD") {
    return Math.round(amount).toLocaleString("en-US");
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

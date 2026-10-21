// The one place a quote's amounts are worked out. The quote form shows exactly what the server will store.
import { TAX_RATE } from "./constants";

export interface QuoteLineInput {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export function calcQuote<T extends QuoteLineInput>(items: T[], overhead: number, discount: number) {
  const lines = items.map((i) => ({ ...i, amount: Math.round((i.quantity || 0) * (i.unit_price || 0)) }));
  const subtotal = lines.reduce((a, b) => a + b.amount, 0);
  const taxable = Math.max(0, subtotal + (overhead || 0) - (discount || 0));
  const tax = Math.round(taxable * TAX_RATE);
  return { lines, subtotal, tax, total: taxable + tax };
}

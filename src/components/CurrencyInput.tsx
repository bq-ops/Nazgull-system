"use client";

import { useEffect, useRef, useState } from "react";
import { toBaseAmount, toDisplayAmount, type Currency } from "@/lib/currency";

interface Props {
  value: string;                           // base-currency value as string
  onChange: (baseValue: string) => void;   // always returns base-currency value
  baseCurrency: Currency;
  defaultRate: number;                     // IQD per 1 USD
  required?: boolean;
  min?: string;
  placeholder?: string;
  className?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  baseCurrency,
  defaultRate,
  required,
  min,
  placeholder,
  className = "",
}: Props) {
  const [inputCurrency, setInputCurrency] = useState<Currency>(baseCurrency);
  const [txnRate, setTxnRate]  = useState(String(defaultRate));
  const [displayValue, setDisplayValue] = useState<string>(value);
  const lastEmitted = useRef<string>(value);

  // Sync when parent changes value externally (e.g. ⚡ fill)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      const num = parseFloat(value);
      if (!value || isNaN(num)) {
        setDisplayValue(value);
      } else {
        const r = parseFloat(txnRate) || defaultRate;
        const disp = toDisplayAmount(num, inputCurrency, baseCurrency, r);
        setDisplayValue(
          inputCurrency === "USD"
            ? disp.toFixed(2)
            : String(Math.round(disp)),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(dv: string, cur: Currency, rate: number) {
    const num = parseFloat(dv);
    if (!dv || isNaN(num)) { onChange(""); return; }
    const base = toBaseAmount(num, cur, baseCurrency, rate);
    const baseStr = String(Math.round(base * 10000) / 10000);
    lastEmitted.current = baseStr;
    onChange(baseStr);
  }

  function handleAmount(raw: string) {
    setDisplayValue(raw);
    emit(raw, inputCurrency, parseFloat(txnRate) || defaultRate);
  }

  function handleRate(newRate: string) {
    setTxnRate(newRate);
    emit(displayValue, inputCurrency, parseFloat(newRate) || defaultRate);
  }

  function toggleCurrency() {
    const next: Currency = inputCurrency === "IQD" ? "USD" : "IQD";
    const num = parseFloat(value);
    const r = parseFloat(txnRate) || defaultRate;
    let newDisplay = "";
    if (value && !isNaN(num)) {
      const disp = toDisplayAmount(num, next, baseCurrency, r);
      newDisplay = next === "USD" ? disp.toFixed(2) : String(Math.round(disp));
    }
    setInputCurrency(next);
    setDisplayValue(newDisplay);
    // base value unchanged — no emit
  }

  const isNonBase = inputCurrency !== baseCurrency;
  const r = parseFloat(txnRate) || defaultRate;
  const inputNum = parseFloat(displayValue);
  const previewBase =
    isNonBase && displayValue && !isNaN(inputNum)
      ? toBaseAmount(inputNum, inputCurrency, baseCurrency, r)
      : null;

  const inputCls =
    "block w-full rounded-l-card border border-border bg-bg px-3 py-2 text-sm text-text tabular-nums placeholder:text-text-muted focus:border-brand-oxblood focus:outline-none focus:ring-1 focus:ring-brand-oxblood";

  return (
    <div>
      <div className="flex">
        <input
          type="number"
          step="any"
          required={required}
          min={min}
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => handleAmount(e.target.value)}
          className={`${inputCls} ${className} flex-1 rounded-r-none`}
        />
        <button
          type="button"
          onClick={toggleCurrency}
          title={isNonBase ? `Entering ${inputCurrency} — converts to ${baseCurrency}` : `Click to enter in USD`}
          className={
            "shrink-0 rounded-r-card border border-l-0 border-border px-2.5 py-2 text-xs font-semibold transition-colors " +
            (isNonBase
              ? "bg-brand-oxblood text-white"
              : "bg-surface text-text-muted hover:bg-blush")
          }
        >
          {inputCurrency}
        </button>
      </div>

      {isNonBase && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-muted">
          <span>Rate (IQD/USD):</span>
          <input
            type="number"
            step="any"
            min="1"
            value={txnRate}
            onChange={(e) => handleRate(e.target.value)}
            className="w-24 rounded-card border border-border bg-bg px-2 py-1 text-xs tabular-nums text-text focus:border-brand-oxblood focus:outline-none"
          />
          {previewBase !== null && (
            <span className="font-medium text-text">
              = {Math.round(previewBase).toLocaleString("en-US")} {baseCurrency}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

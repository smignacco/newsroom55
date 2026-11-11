/** Map stored Yahoo-style symbols to provider-specific identifiers. */
export function finnhubSymbol(stored: string): string {
  switch (stored) {
    case "^GSPC":
      return "SPX";
    case "^IXIC":
      return "IXIC";
    case "^GSPTSE":
      return "GSPTSE";
    default:
      return stored;
  }
}

export function twelveDataSymbol(stored: string): string {
  return stored;
}

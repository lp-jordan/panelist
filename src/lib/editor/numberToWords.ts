const ONES = [
  "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];

const TENS = [
  "", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY",
];

function belowThousand(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const rest = n % 10;
    return rest === 0 ? tens : `${tens}-${ONES[rest]}`;
  }
  const hundreds = ONES[Math.floor(n / 100)];
  const rest = n % 100;
  return rest === 0 ? `${hundreds} HUNDRED` : `${hundreds} HUNDRED ${belowThousand(rest)}`;
}

export function toPageWordNumber(n: number): string {
  if (n <= 0) return ONES[0];
  if (n < 1000) return belowThousand(n);

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return rest === 0 ? `${belowThousand(thousands)} THOUSAND` : `${belowThousand(thousands)} THOUSAND ${belowThousand(rest)}`;
}

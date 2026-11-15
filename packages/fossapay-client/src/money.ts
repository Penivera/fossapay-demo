import BigNumber from 'bignumber.js';

// Set BigNumber config for financial calculations
BigNumber.config({
  DECIMAL_PLACES: 2,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-1e9, 1e9],
});

/**
 * Converts a Naira decimal string or number to integer kobo (1 NGN = 100 kobo).
 * Never uses floating-point math.
 */
export function toKobo(amount: string | number | BigNumber): bigint {
  const bn = new BigNumber(amount);
  if (bn.isNaN() || !bn.isFinite() || bn.isNegative()) {
    throw new Error(`Invalid monetary amount: ${amount}`);
  }
  const koboBn = bn.times(100).integerValue(BigNumber.ROUND_HALF_UP);
  return BigInt(koboBn.toFixed(0));
}

/**
 * Converts integer kobo to a two-decimal place Naira string.
 */
export function fromKobo(kobo: bigint | number | string): string {
  const bn = new BigNumber(kobo.toString());
  if (bn.isNaN() || !bn.isFinite() || bn.isNegative()) {
    throw new Error(`Invalid kobo amount: ${kobo}`);
  }
  return bn.dividedBy(100).toFixed(2);
}

/**
 * Formats a monetary string or number for UI display (e.g., ₦150,000.00).
 */
export function formatNGN(
  amount: string | number | BigNumber,
  options: { showSymbol?: boolean } = { showSymbol: true }
): string {
  const bn = new BigNumber(amount);
  if (bn.isNaN()) return options.showSymbol ? '₦0.00' : '0.00';
  const formatted = bn.toFormat(2, {
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
  });
  return options.showSymbol ? `₦${formatted}` : formatted;
}

/**
 * Adds two monetary decimal amounts safely, returning a 2-decimal string.
 */
export function addMoney(a: string | number, b: string | number): string {
  const koboA = toKobo(a);
  const koboB = toKobo(b);
  return fromKobo(koboA + koboB);
}

/**
 * Subtracts b from a safely, returning a 2-decimal string. Throws if result is negative.
 */
export function subtractMoney(a: string | number, b: string | number): string {
  const koboA = toKobo(a);
  const koboB = toKobo(b);
  if (koboA < koboB) {
    throw new Error(`Cannot subtract ${b} from ${a}: negative monetary amount`);
  }
  return fromKobo(koboA - koboB);
}

/**
 * Distributes total amount into N parts deterministically.
 * Any remainder kobo are distributed +1 to the first `remainder` parts,
 * guaranteeing sum(parts) === totalAmount down to the exact kobo.
 */
export function distributeAmount(totalAmount: string | number, parts: number): string[] {
  if (parts <= 0 || !Number.isInteger(parts)) {
    throw new Error(`Invalid parts count: ${parts}`);
  }

  const totalKobo = toKobo(totalAmount);
  const partsBig = BigInt(parts);
  const baseKobo = totalKobo / partsBig;
  const remainder = Number(totalKobo % partsBig);

  const result: string[] = [];
  for (let i = 0; i < parts; i++) {
    const koboForPart = i < remainder ? baseKobo + 1n : baseKobo;
    result.push(fromKobo(koboForPart));
  }

  return result;
}

/**
 * Verifies that an array of parts sums exactly to the total amount.
 */
export function verifySum(totalAmount: string | number, parts: (string | number)[]): boolean {
  const totalKobo = toKobo(totalAmount);
  let partsKobo = 0n;
  for (const part of parts) {
    partsKobo += toKobo(part);
  }
  return totalKobo === partsKobo;
}

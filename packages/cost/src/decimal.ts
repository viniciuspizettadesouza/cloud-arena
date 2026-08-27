function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function parts(value: string): [bigint, bigint] {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value.trim());
  if (match === null) throw new Error(`Invalid decimal value: ${value}.`);
  const sign = match[1] === "-" ? -1n : 1n;
  const integer = match[2] as string;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0") - fraction.length;
  const digits = BigInt(`${integer}${fraction}` || "0") * sign;
  return exponent >= 0
    ? [digits * 10n ** BigInt(exponent), 1n]
    : [digits, 10n ** BigInt(-exponent)];
}

export class Decimal {
  readonly numerator: bigint;
  readonly denominator: bigint;

  private constructor(numerator: bigint, denominator: bigint) {
    if (denominator === 0n) throw new Error("Cannot divide by zero.");
    const sign = denominator < 0n ? -1n : 1n;
    const divisor = greatestCommonDivisor(numerator, denominator);
    this.numerator = (numerator / divisor) * sign;
    this.denominator = (denominator / divisor) * sign;
  }

  static from(value: string | number | bigint): Decimal {
    if (typeof value === "bigint") return new Decimal(value, 1n);
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error(`Invalid decimal value: ${String(value)}.`);
    const [numerator, denominator] = parts(String(value));
    return new Decimal(numerator, denominator);
  }

  add(value: Decimal): Decimal {
    return new Decimal(
      this.numerator * value.denominator + value.numerator * this.denominator,
      this.denominator * value.denominator,
    );
  }

  subtract(value: Decimal): Decimal {
    return this.add(new Decimal(-value.numerator, value.denominator));
  }

  multiply(value: Decimal): Decimal {
    return new Decimal(this.numerator * value.numerator, this.denominator * value.denominator);
  }

  divide(value: Decimal): Decimal {
    return new Decimal(this.numerator * value.denominator, this.denominator * value.numerator);
  }

  compare(value: Decimal): number {
    const difference = this.numerator * value.denominator - value.numerator * this.denominator;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }

  max(value: Decimal): Decimal {
    return this.compare(value) >= 0 ? this : value;
  }

  min(value: Decimal): Decimal {
    return this.compare(value) <= 0 ? this : value;
  }

  toNumber(): number {
    return Number(this.numerator) / Number(this.denominator);
  }
}

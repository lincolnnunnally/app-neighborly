/**
 * Neighborly tool-rental money — one product, Stripe parked.
 *
 * Split: platform 15% of rental, owner keeps 85%.
 * At book: authorize deposit ≈ replacement_value + charge rental for days.
 * On confirmed return: release deposit. Damage / late / missing can capture the hold.
 *
 * LIVE Stripe stays off until STRIPE_PAYMENTS_ENABLED=true AND STRIPE_SECRET_KEY
 * is set. Without that, list / search / book / meetup still work and the booking
 * is reserved with payment_status = coming_soon.
 */

export const PLATFORM_FEE_RATE = 0.15;

export type ToolPaymentStatus = "coming_soon" | "authorized" | "captured" | "released" | "failed";

export type ToolRentalQuote = {
  days: number;
  rental_cents: number;
  platform_fee_cents: number;
  owner_payout_cents: number;
  deposit_cents: number;
};

export function stripePaymentsLive(): boolean {
  return (
    process.env.STRIPE_PAYMENTS_ENABLED === "true" && Boolean(process.env.STRIPE_SECRET_KEY)
  );
}

export function rentalDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("Pick a valid date range");
  }
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function quoteToolRental(opts: {
  daily_rate_cents: number;
  days: number;
  replacement_value_cents: number;
}): ToolRentalQuote {
  const days = Math.max(1, Math.floor(opts.days));
  const daily = Math.max(0, Math.floor(opts.daily_rate_cents));
  const rental_cents = daily * days;
  const platform_fee_cents = Math.round(rental_cents * PLATFORM_FEE_RATE);
  const owner_payout_cents = rental_cents - platform_fee_cents;
  const deposit_cents = Math.max(0, Math.floor(opts.replacement_value_cents));
  return { days, rental_cents, platform_fee_cents, owner_payout_cents, deposit_cents };
}

export function dollarsToCents(raw: string | number): number {
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,]/g, "").trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid dollar amount");
  return Math.round(n * 100);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (Number(cents) || 0) / 100,
  );
}

export type BeginPaymentResult = {
  payment_status: ToolPaymentStatus;
  stripe_rental_intent_id: string;
  stripe_deposit_intent_id: string;
  message: string;
};

type StripeIntent = { id?: string; error?: { message?: string } };

async function stripePost(path: string, params: Record<string, string>): Promise<StripeIntent> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  return (await res.json()) as StripeIntent;
}

/** Authorize deposit + charge rental when live Stripe is flagged on. */
export async function beginToolPayment(opts: {
  quote: ToolRentalQuote;
  title: string;
  bookingId: string;
}): Promise<BeginPaymentResult> {
  const parked: BeginPaymentResult = {
    payment_status: "coming_soon",
    stripe_rental_intent_id: "",
    stripe_deposit_intent_id: "",
    message: "Payments coming soon — booking reserved",
  };
  if (!stripePaymentsLive()) return parked;

  try {
    let rentalId = "";
    if (opts.quote.rental_cents >= 50) {
      const rental = await stripePost("payment_intents", {
        amount: String(opts.quote.rental_cents),
        currency: "usd",
        capture_method: "automatic",
        description: `Neighborly tool rental: ${opts.title}`,
        "metadata[kind]": "tool_rental",
        "metadata[booking_id]": opts.bookingId,
      });
      if (!rental.id) throw new Error(rental.error?.message || "Rental intent failed");
      rentalId = rental.id;
    }

    let depositId = "";
    if (opts.quote.deposit_cents >= 50) {
      const deposit = await stripePost("payment_intents", {
        amount: String(opts.quote.deposit_cents),
        currency: "usd",
        capture_method: "manual",
        description: `Neighborly tool deposit: ${opts.title}`,
        "metadata[kind]": "tool_deposit",
        "metadata[booking_id]": opts.bookingId,
      });
      if (!deposit.id) throw new Error(deposit.error?.message || "Deposit intent failed");
      depositId = deposit.id;
    }

    return {
      payment_status: "authorized",
      stripe_rental_intent_id: rentalId,
      stripe_deposit_intent_id: depositId,
      message: "Rental charged and deposit authorized",
    };
  } catch (err) {
    return {
      payment_status: "failed",
      stripe_rental_intent_id: "",
      stripe_deposit_intent_id: "",
      message: err instanceof Error ? err.message : "Payment failed — booking still reserved",
    };
  }
}

export async function releaseToolDeposit(intentId: string): Promise<ToolPaymentStatus> {
  if (!intentId || !stripePaymentsLive()) return intentId ? "released" : "coming_soon";
  try {
    await stripePost(`payment_intents/${intentId}/cancel`, {});
    return "released";
  } catch {
    return "failed";
  }
}

export async function captureToolDeposit(intentId: string): Promise<ToolPaymentStatus> {
  if (!intentId || !stripePaymentsLive()) return intentId ? "captured" : "coming_soon";
  try {
    await stripePost(`payment_intents/${intentId}/capture`, {});
    return "captured";
  } catch {
    return "failed";
  }
}

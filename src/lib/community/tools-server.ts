import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseJsonArray, uid } from "@/lib/utils";
import { ensureSeeded } from "./seed";
import {
  beginToolPayment,
  captureToolDeposit,
  quoteToolRental,
  releaseToolDeposit,
  rentalDays,
  stripePaymentsLive,
} from "./payments";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type Tool,
  type ToolBooking,
  type ToolMessage,
} from "./types";

async function db() {
  const sql = await getSql();
  await ensureSeeded(sql);
  return sql;
}

async function ensureMember(
  sql: Awaited<ReturnType<typeof db>>,
  userId: string,
  communityId: string,
) {
  const m = await sql`
    select id from memberships
    where user_id = ${userId} and community_id = ${communityId} and status = 'active'
    limit 1
  `;
  if (m.length === 0) {
    throw new Error("Join this community first to take this action");
  }
}

function parsePhotoUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).slice(0, 4);
  return parseJsonArray(String(raw ?? "[]")).filter(Boolean).slice(0, 4);
}

export function mapTool(r: Record<string, unknown>): Tool {
  return {
    id: String(r.id),
    community_id: String(r.community_id),
    user_id: String(r.user_id),
    owner_name: String(r.owner_name),
    title: String(r.title),
    description: String(r.description ?? ""),
    category: String(r.category),
    condition: String(r.condition),
    photo_urls: parsePhotoUrls(r.photo_urls),
    daily_rate_cents: Number(r.daily_rate_cents ?? 0),
    replacement_value_cents: Number(r.replacement_value_cents ?? 0),
    runs_ready: Boolean(r.runs_ready),
    status: String(r.status),
    street_hint: String(r.street_hint ?? ""),
    created_at: String(r.created_at),
  };
}

export function mapToolBooking(r: Record<string, unknown>): ToolBooking {
  return {
    id: String(r.id),
    tool_id: String(r.tool_id),
    community_id: String(r.community_id),
    owner_user_id: String(r.owner_user_id),
    borrower_user_id: String(r.borrower_user_id),
    borrower_name: String(r.borrower_name),
    start_date: String(r.start_date),
    end_date: String(r.end_date),
    days: Number(r.days ?? 1),
    meetup_note: String(r.meetup_note ?? ""),
    rental_cents: Number(r.rental_cents ?? 0),
    platform_fee_cents: Number(r.platform_fee_cents ?? 0),
    owner_payout_cents: Number(r.owner_payout_cents ?? 0),
    deposit_cents: Number(r.deposit_cents ?? 0),
    status: String(r.status),
    payment_status: String(r.payment_status),
    stripe_rental_intent_id: String(r.stripe_rental_intent_id ?? ""),
    stripe_deposit_intent_id: String(r.stripe_deposit_intent_id ?? ""),
    owner_confirmed_return: Boolean(r.owner_confirmed_return),
    borrower_confirmed_return: Boolean(r.borrower_confirmed_return),
    damage_note: String(r.damage_note ?? ""),
    admin_note: String(r.admin_note ?? ""),
    created_at: String(r.created_at),
    tool_title: r.tool_title == null ? undefined : String(r.tool_title),
    owner_name: r.owner_name == null ? undefined : String(r.owner_name),
  };
}

const CATEGORY_IDS = new Set(TOOL_CATEGORIES.map((c) => c.id));
const CONDITION_IDS = new Set(TOOL_CONDITIONS.map((c) => c.id));

export const getToolPaymentsReady = createServerFn({ method: "GET" }).handler(async () => ({
  live: stripePaymentsLive(),
  message: stripePaymentsLive()
    ? "Stripe is on for this deploy — rental + deposit will attempt to authorize."
    : "Payments coming soon — booking reserved",
}));

export const createTool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      communityId: string;
      title: string;
      description?: string;
      category?: string;
      condition?: string;
      photo_urls?: string[];
      daily_rate_cents: number;
      replacement_value_cents: number;
      runs_ready: boolean;
      street_hint?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    if (!data.runs_ready) {
      throw new Error("Attest that it runs and is ready before listing");
    }
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    const category = CATEGORY_IDS.has(data.category ?? "") ? (data.category as string) : "other";
    const condition = CONDITION_IDS.has(data.condition ?? "") ? (data.condition as string) : "good";
    const daily = Math.max(0, Math.floor(Number(data.daily_rate_cents) || 0));
    const replacement = Math.max(0, Math.floor(Number(data.replacement_value_cents) || 0));
    const photos = (data.photo_urls ?? [])
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 4);

    const sql = await db();
    await ensureMember(sql, context.userId, data.communityId);
    const profile = await sql<{ display_name: string; street_hint: string }>`
      select display_name, street_hint from profiles where user_id = ${context.userId} limit 1
    `;
    const owner = profile[0]?.display_name ?? "Neighbor";
    const street = (data.street_hint ?? profile[0]?.street_hint ?? "").trim();
    const id = uid("tool");
    await sql`
      insert into tools (
        id, community_id, user_id, owner_name, title, description,
        category, condition, photo_urls, daily_rate_cents, replacement_value_cents,
        runs_ready, status, street_hint
      ) values (
        ${id},
        ${data.communityId},
        ${context.userId},
        ${owner},
        ${title},
        ${data.description ?? ""},
        ${category},
        ${condition},
        ${JSON.stringify(photos)},
        ${daily},
        ${replacement},
        true,
        'listed',
        ${street}
      )
    `;
    return { id };
  });

export const setToolStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { toolId: string; status: "listed" | "paused" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const updated = await sql`
      update tools set status = ${data.status}
      where id = ${data.toolId} and user_id = ${context.userId}
    `;
    if (updated.length === 0) {
      const owned = await sql`select id from tools where id = ${data.toolId} and user_id = ${context.userId}`;
      if (owned.length === 0) throw new Error("Tool not found");
    }
    return { ok: true as const };
  });

export const listMyTools = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from tools where user_id = ${context.userId} order by created_at desc
    `;
    return rows.map(mapTool);
  });

export const listMyToolBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select b.*, t.title as tool_title, t.owner_name
      from tool_bookings b
      join tools t on t.id = b.tool_id
      where b.owner_user_id = ${context.userId} or b.borrower_user_id = ${context.userId}
      order by b.created_at desc
      limit 60
    `;
    return rows.map(mapToolBooking);
  });

export const bookTool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: { toolId: string; start_date: string; end_date: string; meetup_note?: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const tools = await sql<Record<string, unknown>>`
      select * from tools where id = ${data.toolId} limit 1
    `;
    const tool = tools[0] ? mapTool(tools[0]) : null;
    if (!tool) throw new Error("Tool not found");
    if (tool.user_id === context.userId) throw new Error("That's your own tool");
    if (tool.status !== "listed") throw new Error("This tool is not available");
    if (!tool.runs_ready) throw new Error("Owner has not attested that it runs");
    await ensureMember(sql, context.userId, tool.community_id);

    const days = rentalDays(data.start_date, data.end_date);
    const overlap = await sql`
      select id from tool_bookings
      where tool_id = ${tool.id}
        and status not in ('cancelled', 'returned')
        and start_date <= ${data.end_date}
        and end_date >= ${data.start_date}
      limit 1
    `;
    if (overlap.length > 0) {
      throw new Error("Those dates overlap another reservation");
    }

    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const name = profile[0]?.display_name ?? "Neighbor";
    const quote = quoteToolRental({
      daily_rate_cents: tool.daily_rate_cents,
      days,
      replacement_value_cents: tool.replacement_value_cents,
    });
    const id = uid("tbook");
    const pay = await beginToolPayment({ quote, title: tool.title, bookingId: id });
    const meetup = data.meetup_note?.trim() || "Let's arrange pickup and return.";

    await sql`
      insert into tool_bookings (
        id, tool_id, community_id, owner_user_id, borrower_user_id, borrower_name,
        start_date, end_date, days, meetup_note,
        rental_cents, platform_fee_cents, owner_payout_cents, deposit_cents,
        status, payment_status, stripe_rental_intent_id, stripe_deposit_intent_id
      ) values (
        ${id},
        ${tool.id},
        ${tool.community_id},
        ${tool.user_id},
        ${context.userId},
        ${name},
        ${data.start_date},
        ${data.end_date},
        ${quote.days},
        ${meetup},
        ${quote.rental_cents},
        ${quote.platform_fee_cents},
        ${quote.owner_payout_cents},
        ${quote.deposit_cents},
        'reserved',
        ${pay.payment_status},
        ${pay.stripe_rental_intent_id},
        ${pay.stripe_deposit_intent_id}
      )
    `;
    await sql`
      insert into tool_messages (id, booking_id, user_id, author_name, message)
      values (${uid("tmsg")}, ${id}, ${context.userId}, ${name}, ${meetup})
    `;
    return {
      id,
      already: false as const,
      payment_status: pay.payment_status,
      message: pay.message,
      quote,
    };
  });

export const messageToolBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; message: string }) => input)
  .handler(async ({ context, data }) => {
    const text = data.message.trim();
    if (!text) throw new Error("Write a note");
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from tool_bookings where id = ${data.bookingId} limit 1
    `;
    if (!rows[0]) throw new Error("Booking not found");
    const booking = mapToolBooking(rows[0]);
    if (booking.owner_user_id !== context.userId && booking.borrower_user_id !== context.userId) {
      throw new Error("Not your booking");
    }
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const name = profile[0]?.display_name ?? "Neighbor";
    await sql`
      insert into tool_messages (id, booking_id, user_id, author_name, message)
      values (${uid("tmsg")}, ${booking.id}, ${context.userId}, ${name}, ${text})
    `;
    if (booking.status === "reserved") {
      await sql`
        update tool_bookings set status = 'pickup_arranged' where id = ${booking.id}
      `;
    }
    return { ok: true as const };
  });

export const listToolBookingMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((bookingId: string) => bookingId)
  .handler(async ({ context, data: bookingId }) => {
    const sql = await db();
    const booking = await sql<{ owner_user_id: string; borrower_user_id: string }>`
      select owner_user_id, borrower_user_id from tool_bookings where id = ${bookingId} limit 1
    `;
    if (!booking[0]) throw new Error("Booking not found");
    if (
      booking[0].owner_user_id !== context.userId &&
      booking[0].borrower_user_id !== context.userId
    ) {
      throw new Error("Not your booking");
    }
    const rows = await sql<Record<string, unknown>>`
      select * from tool_messages where booking_id = ${bookingId} order by created_at asc
    `;
    return rows.map(
      (r): ToolMessage => ({
        id: String(r.id),
        booking_id: String(r.booking_id),
        user_id: String(r.user_id),
        author_name: String(r.author_name),
        message: String(r.message),
        created_at: String(r.created_at),
      }),
    );
  });

export const confirmToolReturn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from tool_bookings where id = ${data.bookingId} limit 1
    `;
    if (!rows[0]) throw new Error("Booking not found");
    const booking = mapToolBooking(rows[0]);
    const isOwner = booking.owner_user_id === context.userId;
    const isBorrower = booking.borrower_user_id === context.userId;
    if (!isOwner && !isBorrower) throw new Error("Not your booking");
    if (booking.status === "cancelled" || booking.status === "returned") {
      return { status: booking.status, payment_status: booking.payment_status };
    }

    const ownerOk = isOwner ? true : booking.owner_confirmed_return;
    const borrowerOk = isBorrower ? true : booking.borrower_confirmed_return;
    const both = ownerOk && borrowerOk;
    let paymentStatus = booking.payment_status;
    let status = both ? "returned" : "return_pending";

    if (both && booking.stripe_deposit_intent_id) {
      paymentStatus = await releaseToolDeposit(booking.stripe_deposit_intent_id);
    }

    await sql`
      update tool_bookings set
        owner_confirmed_return = ${ownerOk},
        borrower_confirmed_return = ${borrowerOk},
        status = ${status},
        payment_status = ${paymentStatus}
      where id = ${booking.id}
    `;
    return { status, payment_status: paymentStatus };
  });

export const reportToolIssue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; damage_note: string; capture_deposit?: boolean }) => input)
  .handler(async ({ context, data }) => {
    const note = data.damage_note.trim();
    if (!note) throw new Error("Describe the damage, late return, or missing tool");
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from tool_bookings where id = ${data.bookingId} limit 1
    `;
    if (!rows[0]) throw new Error("Booking not found");
    const booking = mapToolBooking(rows[0]);
    if (booking.owner_user_id !== context.userId && booking.borrower_user_id !== context.userId) {
      throw new Error("Not your booking");
    }
    let paymentStatus = booking.payment_status;
    if (data.capture_deposit && booking.owner_user_id === context.userId && booking.stripe_deposit_intent_id) {
      paymentStatus = await captureToolDeposit(booking.stripe_deposit_intent_id);
    }
    await sql`
      update tool_bookings set
        status = 'disputed',
        damage_note = ${note},
        payment_status = ${paymentStatus}
      where id = ${booking.id}
    `;
    return { status: "disputed" as const, payment_status: paymentStatus };
  });

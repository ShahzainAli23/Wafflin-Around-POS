import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getPakistanDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;

  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  // 1. Authenticate Hermes
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.HERMES_DAILY_REPORT_SECRET;

  if (
    !expectedSecret ||
    authHeader !== `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      { error: "Server configuration missing" },
      { status: 500 }
    );
  }

  // 2. Server-only Supabase client
  const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  // 3. Work out TODAY specifically in Pakistan
  const date = getPakistanDateKey();

  const startMs = Date.parse(`${date}T00:00:00+05:00`);
  const nextDayMs = startMs + 24 * 60 * 60 * 1000;

  const start = new Date(startMs).toISOString();
  const nextDay = new Date(nextDayMs).toISOString();

  // 4. Get today's orders and expenses
  const [ordersResult, expensesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("total, payment_method, status, created_at")
      .gte("created_at", start)
      .lt("created_at", nextDay)
      .neq("status", "cancelled"),

    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("expense_date", date),
  ]);

  if (ordersResult.error) {
    console.error("Orders error:", ordersResult.error);
    return NextResponse.json(
      { error: "Could not load orders" },
      { status: 500 }
    );
  }

  if (expensesResult.error) {
    console.error("Expenses error:", expensesResult.error);
    return NextResponse.json(
      { error: "Could not load expenses" },
      { status: 500 }
    );
  }

  const orders = ordersResult.data ?? [];
  const expenses = expensesResult.data ?? [];

  // 5. Calculate everything
  const total = orders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const cash = orders
    .filter((order) => order.payment_method === "cash")
    .reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

  const nayapay = orders
    .filter((order) => order.payment_method === "nayapay")
    .reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

  const meezan = orders
    .filter((order) => order.payment_method === "meezan")
    .reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

  const expense = expenses.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  const profit = total - expense;

  // 6. Return numbers only
  return NextResponse.json({
    date,
    total,
    cash,
    nayapay,
    meezan,
    expense,
    profit,
  });
}
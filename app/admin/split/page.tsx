"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Expense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  note: string | null;
  created_at: string;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

type LegacyRevenue = {
  id: string;
  revenue_date: string;
  revenue: number;
  nayapay: number;
  cash: number;
  meezan: number;
};

type MonthlyRow = {
  month: string;
  label: string;
  revenue: number;
  legacyRevenue: number;
  posRevenue: number;
  expenses: number;
  profit: number;
};

function money(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toLocaleString();

  if (rounded < 0) {
    return `- Rs. ${abs}`;
  }

  return `Rs. ${abs}`;
}

function monthKey(value: string) {
  return new Date(value).toISOString().slice(0, 7);
}

function monthKeyFromDateColumn(value: string) {
  return value.slice(0, 7);
}

function formatMonthLabel(key: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function SplitPage() {
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [legacyRevenue, setLegacyRevenue] = useState<LegacyRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState("");
  const [fatimaPercent, setFatimaPercent] = useState(50);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/pos");
        return;
      }

      const { data: expenseData } = await supabase
        .from("expenses")
        .select("id, category, amount, expense_date, note, created_at")
        .order("expense_date", { ascending: false });

      const { data: orderData } = await supabase
        .from("orders")
        .select("id, total, status, created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      const { data: legacyRevenueData } = await supabase
        .from("legacy_revenue")
        .select("id, revenue_date, revenue, nayapay, cash, meezan")
        .order("revenue_date", { ascending: false });

      setExpenses((expenseData || []) as Expense[]);
      setOrders((orderData || []) as Order[]);
      setLegacyRevenue((legacyRevenueData || []) as LegacyRevenue[]);
    } finally {
      setLoading(false);
    }
  }

  const monthlyRows = useMemo(() => {
    const map = new Map<string, MonthlyRow>();

    function ensureMonth(key: string) {
      const existing = map.get(key);

      if (existing) return existing;

      const row: MonthlyRow = {
        month: key,
        label: formatMonthLabel(key),
        revenue: 0,
        legacyRevenue: 0,
        posRevenue: 0,
        expenses: 0,
        profit: 0,
      };

      map.set(key, row);
      return row;
    }

    expenses.forEach((expense) => {
      const key = monthKeyFromDateColumn(expense.expense_date);
      const row = ensureMonth(key);
      row.expenses += Number(expense.amount || 0);
    });

    orders.forEach((order) => {
      const key = monthKey(order.created_at);
      const row = ensureMonth(key);
      row.revenue += Number(order.total || 0);
      row.posRevenue += Number(order.total || 0);
    });

    legacyRevenue.forEach((revenueRow) => {
      const key = monthKeyFromDateColumn(revenueRow.revenue_date);
      const row = ensureMonth(key);
      row.revenue += Number(revenueRow.revenue || 0);
      row.legacyRevenue += Number(revenueRow.revenue || 0);
    });

    const rows = Array.from(map.values())
      .map((row) => ({
        ...row,
        profit: row.revenue - row.expenses,
      }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));

    return rows;
  }, [expenses, orders, legacyRevenue]);

  useEffect(() => {
    if (monthlyRows.length === 0) return;

    const exists = monthlyRows.some((row) => row.month === selectedMonth);

    if (!selectedMonth || !exists) {
      setSelectedMonth(monthlyRows[monthlyRows.length - 1].month);
    }
  }, [monthlyRows, selectedMonth]);

  const selectedRow = useMemo(() => {
    if (monthlyRows.length === 0) return null;

    return (
      monthlyRows.find((row) => row.month === selectedMonth) ||
      monthlyRows[monthlyRows.length - 1]
    );
  }, [monthlyRows, selectedMonth]);

  const shahzainPercent = 100 - fatimaPercent;

  const fatimaShare = selectedRow
    ? (selectedRow.profit * fatimaPercent) / 100
    : 0;

  const shahzainShare = selectedRow
    ? (selectedRow.profit * shahzainPercent) / 100
    : 0;

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 lg:p-6">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-center">
            <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
            <h2 className="mt-4 text-2xl font-bold">Loading split page</h2>
            <p className="mt-2 text-white/60">Please wait...</p>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="rounded-[34px] border border-white/10 bg-[#151922] p-5 lg:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Wafflin' Around"
                className="h-14 w-14 object-contain rounded-2xl"
              />

              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-[#d81b72]">
                  Wafflin' Around
                </p>
                <h1 className="text-3xl lg:text-4xl font-bold mt-2">
                  Monthly Profit Split
                </h1>
                <p className="text-white/60 mt-2">
                  Select a month and split monthly profit between Fatima and
                  Shahzain.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Back
              </Link>

              <button
                onClick={loadData}
                className="rounded-2xl bg-[#d81b72] px-5 py-3 font-bold text-white"
              >
                Refresh
              </button>

              <button
                onClick={logout}
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <section className="grid xl:grid-cols-[440px_1fr] gap-5 mt-5">
          <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5 h-fit">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#d81b72]">
                Controls
              </p>
              <h2 className="text-2xl font-bold mt-2">Select Month</h2>
              <p className="text-white/50 mt-1">
                Choose the month and adjust Fatima’s percentage. Shahzain gets
                the remaining percentage.
              </p>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-bold text-white/70 mb-2">
                Month
              </label>

              <select
                value={selectedRow?.month || selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white font-bold"
              >
                {monthlyRows
                  .slice()
                  .reverse()
                  .map((row) => (
                    <option key={row.month} value={row.month}>
                      {row.label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-6 rounded-[28px] bg-white/5 border border-white/10 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60">Fatima Share</p>
                  <h3 className="text-3xl font-bold mt-1">
                    {fatimaPercent}%
                  </h3>
                </div>

                <div className="text-right">
                  <p className="text-white/60">Shahzain Share</p>
                  <h3 className="text-3xl font-bold mt-1">
                    {shahzainPercent}%
                  </h3>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={fatimaPercent}
                onChange={(e) => setFatimaPercent(Number(e.target.value))}
                className="w-full mt-6 accent-[#d81b72]"
              />

              <div className="flex justify-between text-xs text-white/45 mt-2">
                <span>Fatima 0%</span>
                <span>50 / 50</span>
                <span>Fatima 100%</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5">
                <button
                  onClick={() => setFatimaPercent(50)}
                  className="rounded-xl bg-white/5 border border-white/10 py-2 font-bold"
                >
                  50/50
                </button>

                <button
                  onClick={() => setFatimaPercent(60)}
                  className="rounded-xl bg-white/5 border border-white/10 py-2 font-bold"
                >
                  60/40
                </button>

                <button
                  onClick={() => setFatimaPercent(70)}
                  className="rounded-xl bg-white/5 border border-white/10 py-2 font-bold"
                >
                  70/30
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {selectedRow ? (
              <>
                <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-[#d81b72]">
                        Selected Month
                      </p>
                      <h2 className="text-3xl lg:text-4xl font-bold mt-2">
                        {selectedRow.label}
                      </h2>
                    </div>

                    <div
                      className={`rounded-2xl px-5 py-3 font-bold ${
                        selectedRow.profit < 0
                          ? "bg-red-500/10 text-red-200 border border-red-500/25"
                          : "bg-green-500/10 text-green-200 border border-green-500/25"
                      }`}
                    >
                      {selectedRow.profit < 0 ? "Loss Month" : "Profit Month"}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
                    <div className="rounded-[28px] bg-white/5 border border-white/10 p-5">
                      <p className="text-white/60">Revenue</p>
                      <h3 className="text-3xl font-bold mt-2">
                        {money(selectedRow.revenue)}
                      </h3>
                      <p className="text-white/40 text-sm mt-2">
                        Legacy + POS
                      </p>
                    </div>

                    <div className="rounded-[28px] bg-white/5 border border-white/10 p-5">
                      <p className="text-white/60">Expenses</p>
                      <h3 className="text-3xl font-bold mt-2">
                        {money(selectedRow.expenses)}
                      </h3>
                    </div>

                    <div
                      className={`rounded-[28px] border p-5 ${
                        selectedRow.profit < 0
                          ? "bg-red-500/10 border-red-500/25"
                          : "bg-green-500/10 border-green-500/25"
                      }`}
                    >
                      <p className="text-white/60">Monthly Profit</p>
                      <h3
                        className={`text-3xl font-bold mt-2 ${
                          selectedRow.profit < 0
                            ? "text-red-200"
                            : "text-green-200"
                        }`}
                      >
                        {money(selectedRow.profit)}
                      </h3>
                      <p className="text-white/40 text-sm mt-2">
                        Revenue - Expenses
                      </p>
                    </div>

                    <div className="rounded-[28px] bg-white/5 border border-white/10 p-5">
                      <p className="text-white/60">Split Rule</p>
                      <h3 className="text-3xl font-bold mt-2">
                        {fatimaPercent}/{shahzainPercent}
                      </h3>
                      <p className="text-white/40 text-sm mt-2">
                        Fatima / Shahzain
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="rounded-[34px] bg-[#d81b72]/10 border border-[#d81b72]/30 p-6 shadow-[0_18px_45px_rgba(216,27,114,0.12)]">
                    <p className="text-white/60">Fatima</p>
                    <h2
                      className={`text-5xl font-bold mt-3 ${
                        fatimaShare < 0 ? "text-red-200" : "text-pink-100"
                      }`}
                    >
                      {money(fatimaShare)}
                    </h2>
                    <p className="text-white/50 mt-3">
                      {fatimaPercent}% of monthly profit/loss
                    </p>
                  </div>

                  <div className="rounded-[34px] bg-[#8b4b39]/20 border border-[#8b4b39]/40 p-6 shadow-[0_18px_45px_rgba(139,75,57,0.12)]">
                    <p className="text-white/60">Shahzain</p>
                    <h2
                      className={`text-5xl font-bold mt-3 ${
                        shahzainShare < 0 ? "text-red-200" : "text-pink-100"
                      }`}
                    >
                      {money(shahzainShare)}
                    </h2>
                    <p className="text-white/50 mt-3">
                      {shahzainPercent}% of monthly profit/loss
                    </p>
                  </div>
                </div>

                <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
                  <h2 className="text-2xl font-bold">Revenue Breakdown</h2>

                  <div className="grid md:grid-cols-2 gap-4 mt-5">
                    <div className="rounded-[24px] bg-white/5 border border-white/10 p-5">
                      <p className="text-white/60">Legacy Revenue</p>
                      <h3 className="text-3xl font-bold mt-2">
                        {money(selectedRow.legacyRevenue)}
                      </h3>
                    </div>

                    <div className="rounded-[24px] bg-white/5 border border-white/10 p-5">
                      <p className="text-white/60">POS Revenue</p>
                      <h3 className="text-3xl font-bold mt-2">
                        {money(selectedRow.posRevenue)}
                      </h3>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[34px] bg-[#151922] border border-white/10 p-8 text-center text-white/60">
                No monthly data found.
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold">All Months</h2>
              <p className="text-white/50 mt-1">
                Click a month to view its split above.
              </p>
            </div>

            <p className="text-[#d81b72] font-bold">
              {monthlyRows.length} months
            </p>
          </div>

          {monthlyRows.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-4 text-white/55">
              No month data found.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {monthlyRows
                .slice()
                .reverse()
                .map((row) => {
                  const isSelected = selectedRow?.month === row.month;
                  const rowFatima = (row.profit * fatimaPercent) / 100;
                  const rowShahzain = (row.profit * shahzainPercent) / 100;

                  return (
                    <button
                      key={row.month}
                      onClick={() => setSelectedMonth(row.month)}
                      className={`rounded-[28px] p-5 text-left border transition ${
                        isSelected
                          ? "bg-[#d81b72] border-[#d81b72]"
                          : "bg-white/5 border-white/10 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white/60 text-sm">{row.label}</p>
                          <h3
                            className={`text-3xl font-bold mt-2 ${
                              row.profit < 0
                                ? "text-red-200"
                                : isSelected
                                ? "text-white"
                                : "text-green-200"
                            }`}
                          >
                            {money(row.profit)}
                          </h3>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            row.profit < 0
                              ? "bg-red-500/20 text-red-200"
                              : "bg-green-500/20 text-green-200"
                          }`}
                        >
                          {row.profit < 0 ? "Loss" : "Profit"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="rounded-2xl bg-black/15 p-3">
                          <p className="text-white/50 text-sm">Fatima</p>
                          <p className="font-bold">{money(rowFatima)}</p>
                        </div>

                        <div className="rounded-2xl bg-black/15 p-3">
                          <p className="text-white/50 text-sm">Shahzain</p>
                          <p className="font-bold">{money(rowShahzain)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div className="rounded-2xl bg-black/15 p-3">
                          <p className="text-white/50">Revenue</p>
                          <p className="font-bold">{money(row.revenue)}</p>
                        </div>

                        <div className="rounded-2xl bg-black/15 p-3">
                          <p className="text-white/50">Expenses</p>
                          <p className="font-bold">{money(row.expenses)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
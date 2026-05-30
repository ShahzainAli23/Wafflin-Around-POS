"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ExpenseCategory =
  | "imtiaz"
  | "wages"
  | "utility_rent"
  | "milk"
  | "ice_cream"
  | "miscellaneous"
  | "ice"
  | "equipment"
  | "repairs"
  | "upgrades"
  | "food"
  | "packaging"
  | "coffee"
  | "event"
  | "toppings"
  | "syrups";

type Expense = {
  id: string;
  category: ExpenseCategory;
  item_name: string | null;
  amount: number;
  expense_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  legacy_key?: string | null;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  payment_method?: "cash" | "nayapay" | "meezan" | string;
};

type LegacyRevenue = {
  id: string;
  revenue_date: string;
  revenue: number;
  nayapay: number;
  cash: number;
  meezan: number;
  source: string | null;
  created_at: string;
};

type RangeMode = "day" | "7d" | "15d" | "1m" | "3m" | "6m" | "year" | "all";

type BreakdownRow = {
  name: string;
  value: number;
};

const expenseCategories: { key: ExpenseCategory; label: string }[] = [
  { key: "imtiaz", label: "Imtiaz" },
  { key: "toppings", label: "Toppings" },
  { key: "syrups", label: "Syrups" },
  { key: "ice_cream", label: "Ice Cream" },
  { key: "coffee", label: "Coffee" },
  { key: "milk", label: "Milk" },
  { key: "packaging", label: "Packaging" },
  { key: "food", label: "Food" },
  { key: "wages", label: "Wages" },
  { key: "utility_rent", label: "Utility & Rent" },
  { key: "equipment", label: "Equipment" },
  { key: "upgrades", label: "Upgrades" },
  { key: "event", label: "Event" },
  { key: "ice", label: "Ice" },
  { key: "repairs", label: "Repairs" },
  { key: "miscellaneous", label: "Miscellaneous" },
];

const categoryItems: Record<ExpenseCategory, string[]> = {
  imtiaz: [
    "Eggs",
    "Sugar",
    "Cream",
    "Packaged Brown Sugar",
    "Packaged White Sugar",
    "Flour",
    "Cleaning",
    "Miscellaneous",
    "Baking Powder",
    "Vanilla Essence",
    "Oil",
    "Salt",
    "Crave Chocolate",
    "Garbage Bags",
    "Jalal Cleaning",
  ],

  toppings: [
    "Nutella",
    "Chocolate",
    "Strawberry",
    "Maple",
    "Chocolate Chips",
    "Oreos",
    "Dairy Milk",
    "Marshmellow",
  ],

  syrups: ["Chocolate", "Hazelnut", "Vanilla", "Caramel"],

  ice_cream: ["Strawberry", "Vanilla", "Chocolate", "Cookies & Cream"],

  wages: ["Miscellaneous"],
  utility_rent: ["Miscellaneous"],
  milk: ["Miscellaneous"],
  miscellaneous: ["Miscellaneous"],
  ice: ["Miscellaneous"],
  equipment: ["Miscellaneous"],
  repairs: ["Miscellaneous"],
  upgrades: ["Miscellaneous"],
  food: ["Miscellaneous"],
  packaging: ["Miscellaneous"],
  coffee: ["Miscellaneous"],
  event: ["Miscellaneous"],
};

const rangeOptions: { key: RangeMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" },
  { key: "1m", label: "1 Month" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
];

const pieColors = [
  "#d81b72",
  "#8b4b39",
  "#f0c8d9",
  "#f59e0b",
  "#22c55e",
  "#38bdf8",
  "#a78bfa",
  "#fb7185",
  "#eab308",
  "#94a3b8",
  "#34d399",
  "#f97316",
  "#60a5fa",
  "#c084fc",
  "#f43f5e",
  "#14b8a6",
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  const rounded = Math.round(value || 0);
  const abs = Math.abs(rounded).toLocaleString();

  if (rounded < 0) {
    return `- Rs. ${abs}`;
  }

  return `Rs. ${abs}`;
}

function categoryLabel(key: string) {
  return expenseCategories.find((cat) => cat.key === key)?.label || key;
}

function normalizeItemName(value: string | null | undefined) {
  if (!value || value.trim() === "") return "Miscellaneous";
  return value.trim();
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getRange(selectedDate: string, mode: RangeMode) {
  const base = new Date(`${selectedDate}T00:00:00`);
  const end = endOfDay(base);
  const start = new Date(base);

  if (mode === "day") {
    return { start: startOfDay(start), end };
  }

  if (mode === "7d") {
    start.setDate(start.getDate() - 6);
    return { start: startOfDay(start), end };
  }

  if (mode === "15d") {
    start.setDate(start.getDate() - 14);
    return { start: startOfDay(start), end };
  }

  if (mode === "1m") {
    start.setDate(start.getDate() - 29);
    return { start: startOfDay(start), end };
  }

  if (mode === "3m") {
    start.setDate(start.getDate() - 89);
    return { start: startOfDay(start), end };
  }

  if (mode === "6m") {
    start.setDate(start.getDate() - 179);
    return { start: startOfDay(start), end };
  }

  if (mode === "year") {
    start.setDate(start.getDate() - 364);
    return { start: startOfDay(start), end };
  }

  return { start: null, end: null };
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthKey(value: string) {
  return new Date(value).toISOString().slice(0, 7);
}

function safeDateFromDateColumn(value: string) {
  return new Date(`${value}T12:00:00`);
}

function buildBreakdown(
  expenses: Expense[],
  targetCategory: ExpenseCategory
): BreakdownRow[] {
  const map = new Map<string, number>();

  expenses
    .filter((expense) => expense.category === targetCategory)
    .forEach((expense) => {
      const label = normalizeItemName(expense.item_name);
      map.set(label, (map.get(label) || 0) + Number(expense.amount || 0));
    });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export default function ExpensesPage() {
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [legacyRevenue, setLegacyRevenue] = useState<LegacyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [rangeMode, setRangeMode] = useState<RangeMode>("1m");

  const [category, setCategory] = useState<ExpenseCategory>("imtiaz");
  const [itemName, setItemName] = useState("Eggs");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  function changeCategory(nextCategory: ExpenseCategory) {
    setCategory(nextCategory);

    if (
      nextCategory === "imtiaz" ||
      nextCategory === "toppings" ||
      nextCategory === "syrups" ||
      nextCategory === "ice_cream"
    ) {
      setItemName(categoryItems[nextCategory][0]);
    } else {
      setItemName("Miscellaneous");
    }
  }

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
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      const { data: orderData } = await supabase
        .from("orders")
        .select("id, total, status, created_at, payment_method")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      const { data: legacyRevenueData } = await supabase
        .from("legacy_revenue")
        .select("*")
        .order("revenue_date", { ascending: false });

      setExpenses((expenseData || []) as Expense[]);
      setOrders((orderData || []) as Order[]);
      setLegacyRevenue((legacyRevenueData || []) as LegacyRevenue[]);
    } finally {
      setLoading(false);
    }
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (saving) return;

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setNotice("Enter a valid amount");
      return;
    }

    setSaving(true);
    setNotice("Saving expense...");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase.from("expenses").insert({
        category,
        item_name: itemName,
        amount: numericAmount,
        expense_date: expenseDate,
        note: note.trim() || null,
        created_by: user.id,
      });

      if (error) {
        setNotice("Could not save expense");
        return;
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "EXPENSE_CREATED",
        details: {
          category,
          itemName,
          amount: numericAmount,
          expenseDate,
          note: note.trim() || null,
        },
      });

      setAmount("");
      setNote("");
      setExpenseDate(todayKey());
      setCategory("imtiaz");
      setItemName("Eggs");
      setNotice("Expense saved");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expense: Expense) {
    if (saving) return;

    const confirmed = confirm(
      `Delete ${categoryLabel(expense.category)} - ${normalizeItemName(
        expense.item_name
      )} expense of ${money(Number(expense.amount))}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setNotice("Deleting expense...");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);

      if (error) {
        setNotice("Could not delete expense");
        return;
      }

      if (user) {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "EXPENSE_DELETED",
          details: {
            expenseId: expense.id,
            category: expense.category,
            itemName: expense.item_name,
            amount: expense.amount,
            expenseDate: expense.expense_date,
            legacyKey: expense.legacy_key || null,
          },
        });
      }

      setNotice("Expense deleted");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const filteredExpenses = useMemo(() => {
    const { start, end } = getRange(selectedDate, rangeMode);

    if (!start || !end) return expenses;

    return expenses.filter((expense) => {
      const d = safeDateFromDateColumn(expense.expense_date);
      return d >= start && d <= end;
    });
  }, [expenses, selectedDate, rangeMode]);

  const filteredOrders = useMemo(() => {
    const { start, end } = getRange(selectedDate, rangeMode);

    if (!start || !end) return orders;

    return orders.filter((order) => {
      const d = new Date(order.created_at);
      return d >= start && d <= end;
    });
  }, [orders, selectedDate, rangeMode]);

  const filteredLegacyRevenue = useMemo(() => {
    const { start, end } = getRange(selectedDate, rangeMode);

    if (!start || !end) return legacyRevenue;

    return legacyRevenue.filter((row) => {
      const d = safeDateFromDateColumn(row.revenue_date);
      return d >= start && d <= end;
    });
  }, [legacyRevenue, selectedDate, rangeMode]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );
  }, [filteredExpenses]);

  const posRevenue = useMemo(() => {
    return filteredOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );
  }, [filteredOrders]);

  const legacyRevenueTotal = useMemo(() => {
    return filteredLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.revenue || 0),
      0
    );
  }, [filteredLegacyRevenue]);

  const totalRevenue = posRevenue + legacyRevenueTotal;
  const netProfit = totalRevenue - totalExpenses;

  const totalCash = useMemo(() => {
    const legacyCash = filteredLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.cash || 0),
      0
    );

    const posCash = filteredOrders
      .filter((order) => order.payment_method === "cash")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    return legacyCash + posCash;
  }, [filteredLegacyRevenue, filteredOrders]);

  const totalNayapay = useMemo(() => {
    const legacyNayapay = filteredLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.nayapay || 0),
      0
    );

    const posNayapay = filteredOrders
      .filter((order) => order.payment_method === "nayapay")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    return legacyNayapay + posNayapay;
  }, [filteredLegacyRevenue, filteredOrders]);

  const totalMeezan = useMemo(() => {
    const legacyMeezan = filteredLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.meezan || 0),
      0
    );

    const posMeezan = filteredOrders
      .filter((order) => order.payment_method === "meezan")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    return legacyMeezan + posMeezan;
  }, [filteredLegacyRevenue, filteredOrders]);

  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();

    filteredExpenses.forEach((expense) => {
      map.set(
        expense.category,
        (map.get(expense.category) || 0) + Number(expense.amount || 0)
      );
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name: categoryLabel(name),
        value,
        raw: name,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const imtiazBreakdown = useMemo(() => {
    return buildBreakdown(filteredExpenses, "imtiaz");
  }, [filteredExpenses]);

  const toppingsBreakdown = useMemo(() => {
    return buildBreakdown(filteredExpenses, "toppings");
  }, [filteredExpenses]);

  const syrupsBreakdown = useMemo(() => {
    return buildBreakdown(filteredExpenses, "syrups");
  }, [filteredExpenses]);

  const iceCreamBreakdown = useMemo(() => {
    return buildBreakdown(filteredExpenses, "ice_cream");
  }, [filteredExpenses]);

  const dailyTrend = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        expenses: number;
        revenue: number;
      }
    >();

    filteredExpenses.forEach((expense) => {
      const key = expense.expense_date;
      const existing = map.get(key) || {
        date: key,
        expenses: 0,
        revenue: 0,
      };

      existing.expenses += Number(expense.amount || 0);
      map.set(key, existing);
    });

    filteredOrders.forEach((order) => {
      const key = dateKey(order.created_at);
      const existing = map.get(key) || {
        date: key,
        expenses: 0,
        revenue: 0,
      };

      existing.revenue += Number(order.total || 0);
      map.set(key, existing);
    });

    filteredLegacyRevenue.forEach((row) => {
      const key = row.revenue_date;
      const existing = map.get(key) || {
        date: key,
        expenses: 0,
        revenue: 0,
      };

      existing.revenue += Number(row.revenue || 0);
      map.set(key, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((row) => ({
        ...row,
        label: new Date(`${row.date}T00:00:00`).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        }),
        profit: row.revenue - row.expenses,
      }));
  }, [filteredExpenses, filteredOrders, filteredLegacyRevenue]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        expenses: number;
        revenue: number;
        posRevenue: number;
        legacyRevenue: number;
      }
    >();

    expenses.forEach((expense) => {
      const key = monthKey(expense.expense_date);
      const existing = map.get(key) || {
        month: key,
        expenses: 0,
        revenue: 0,
        posRevenue: 0,
        legacyRevenue: 0,
      };

      existing.expenses += Number(expense.amount || 0);
      map.set(key, existing);
    });

    orders.forEach((order) => {
      const key = monthKey(order.created_at);
      const existing = map.get(key) || {
        month: key,
        expenses: 0,
        revenue: 0,
        posRevenue: 0,
        legacyRevenue: 0,
      };

      existing.revenue += Number(order.total || 0);
      existing.posRevenue += Number(order.total || 0);
      map.set(key, existing);
    });

    legacyRevenue.forEach((row) => {
      const key = monthKey(row.revenue_date);
      const existing = map.get(key) || {
        month: key,
        expenses: 0,
        revenue: 0,
        posRevenue: 0,
        legacyRevenue: 0,
      };

      existing.revenue += Number(row.revenue || 0);
      existing.legacyRevenue += Number(row.revenue || 0);
      map.set(key, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => (a.month > b.month ? 1 : -1))
      .map((row) => ({
        ...row,
        label: new Date(`${row.month}-01T00:00:00`).toLocaleDateString(
          "en-GB",
          {
            month: "short",
            year: "2-digit",
          }
        ),
        profit: row.revenue - row.expenses,
      }));
  }, [expenses, orders, legacyRevenue]);

  const biggestExpense = categorySummary[0];

  const avgDailyExpense = useMemo(() => {
    if (dailyTrend.length === 0) return 0;
    return totalExpenses / dailyTrend.length;
  }, [dailyTrend.length, totalExpenses]);

  const rangeLabel =
    rangeOptions.find((option) => option.key === rangeMode)?.label || "Range";

  function BreakdownChart({
    title,
    subtitle,
    rows,
  }: {
    title: string;
    subtitle: string;
    rows: BreakdownRow[];
  }) {
    return (
      <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-white/50 text-sm mt-1">{subtitle}</p>
          </div>
          <p className="text-[#d81b72] font-bold">{rows.length}</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white/5 p-4 text-white/55">
            No data in selected range
          </div>
        ) : (
          <>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={92}
                    paddingAngle={4}
                  >
                    {rows.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "#0f1115",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-4">
              {rows.map((row, index) => (
                <div
                  key={row.name}
                  className="rounded-2xl bg-white/5 px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{
                        backgroundColor: pieColors[index % pieColors.length],
                      }}
                    />
                    <p className="font-bold">{row.name}</p>
                  </div>
                  <p className="text-white/70">{money(row.value)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 lg:p-6">
      {(loading || saving) && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-center">
            <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
            <h2 className="mt-4 text-2xl font-bold">
              {saving ? "Updating expenses" : "Loading expenses"}
            </h2>
            <p className="mt-2 text-white/60">Please wait...</p>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto">
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
                  Expense Manager
                </h1>
                <p className="text-white/60 mt-2">
                  Main categories for reporting. Specific items for inventory.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Admin Home
              </Link>

              <Link
                href="/admin/dashboard"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Dashboard
              </Link>

              <Link
                href="/admin/reports"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Reports
              </Link>

              <Link
                href="/admin/split"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Split
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

        <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5 lg:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#d81b72]">
                New Entry
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-2">
                Add Expense
              </h2>
              <p className="text-white/50 mt-1">
                Only Imtiaz, Toppings, Syrups, and Ice Cream have specific
                inventory breakdowns.
              </p>
            </div>

            {notice && (
              <div className="rounded-2xl bg-[#d81b72]/15 border border-[#d81b72]/30 px-4 py-3 text-pink-100 font-bold">
                {notice}
              </div>
            )}
          </div>

          <form onSubmit={addExpense} className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-white/70 mb-3">
                Main Category
              </label>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8 gap-3">
                {expenseCategories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => changeCategory(cat.key)}
                    className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${
                      category === cat.key
                        ? "bg-[#d81b72] border-[#d81b72] text-white shadow-[0_10px_25px_rgba(216,27,114,0.24)]"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/8"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-white/70 mb-3">
                Specific Item
              </label>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {categoryItems[category].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setItemName(item)}
                    className={`rounded-2xl border px-4 py-3 text-left font-bold transition ${
                      itemName === item
                        ? "bg-[#8b4b39] border-[#8b4b39] text-white"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/8"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_1fr_2fr_auto] gap-4 items-end">
              <div>
                <label className="block text-sm font-bold text-white/70 mb-2">
                  Amount
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  className="w-full rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-white/70 mb-2">
                  Date
                </label>
                <input
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  type="date"
                  className="w-full rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-white/70 mb-2">
                  Note
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  className="w-full rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className={`rounded-2xl px-8 py-3 font-bold h-[50px] ${
                  saving
                    ? "bg-[#67565f] cursor-not-allowed"
                    : "bg-[#d81b72] hover:bg-[#c21766]"
                }`}
              >
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Expense Analytics</h2>
              <p className="text-white/50 mt-1">
                Select a date and range to view spending reports.
              </p>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setRangeMode(option.key)}
                className={`rounded-2xl px-4 py-2.5 font-bold ${
                  rangeMode === option.key
                    ? "bg-[#d81b72] text-white"
                    : "bg-white/5 text-white/80 border border-white/10"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 mt-5">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#d81b72,#a10d52)] p-5 xl:col-span-2">
            <p className="text-white/75">Net Profit</p>
            <h3
              className={`text-4xl font-bold mt-3 ${
                netProfit < 0 ? "text-red-100" : "text-white"
              }`}
            >
              {money(netProfit)}
            </h3>
            <p className="text-white/70 mt-2">
              Revenue minus expenses for {rangeLabel}
            </p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Total Revenue</p>
            <h3 className="text-3xl font-bold mt-2">{money(totalRevenue)}</h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Expenses</p>
            <h3 className="text-3xl font-bold mt-2">{money(totalExpenses)}</h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Avg Daily Expense</p>
            <h3 className="text-3xl font-bold mt-2">
              {money(avgDailyExpense)}
            </h3>
          </div>
        </section>

        <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 mt-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Legacy Revenue</p>
            <h3 className="text-3xl font-bold mt-2">
              {money(legacyRevenueTotal)}
            </h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">POS Revenue</p>
            <h3 className="text-3xl font-bold mt-2">{money(posRevenue)}</h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Cash</p>
            <h3 className="text-3xl font-bold mt-2">{money(totalCash)}</h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Nayapay</p>
            <h3 className="text-3xl font-bold mt-2">{money(totalNayapay)}</h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Meezan</p>
            <h3 className="text-3xl font-bold mt-2">{money(totalMeezan)}</h3>
          </div>
        </section>

        <section className="grid xl:grid-cols-[1.2fr_0.8fr] gap-5 mt-5">
          <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">Revenue vs Expenses</h2>
                <p className="text-white/50 text-sm mt-1">
                  Includes legacy revenue and live POS revenue.
                </p>
              </div>
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend}>
                  <XAxis dataKey="label" stroke="#c7c7c7" />
                  <YAxis stroke="#c7c7c7" />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "#0f1115",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                    }}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expenses" fill="#d81b72" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
                <p className="text-white/70">Revenue</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#d81b72]" />
                <p className="text-white/70">Expenses</p>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">Main Expense Split</h2>
                <p className="text-white/50 text-sm mt-1">
                  Big reporting categories
                </p>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySummary}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                  >
                    {categorySummary.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "#0f1115",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-4">
              {categorySummary.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/55">
                  No category data
                </div>
              ) : (
                categorySummary.map((row, index) => (
                  <div
                    key={row.name}
                    className="rounded-2xl bg-white/5 px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{
                          backgroundColor: pieColors[index % pieColors.length],
                        }}
                      />
                      <p className="font-bold">{row.name}</p>
                    </div>
                    <p className="text-white/70">{money(row.value)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid xl:grid-cols-2 gap-5 mt-5">
          <BreakdownChart
            title="Imtiaz Breakdown"
            subtitle="Eggs, sugar, cream, flour, baking powder, vanilla essence, oil, salt, crave chocolate, garbage bags, cleaning, Jalal cleaning, and miscellaneous"
            rows={imtiazBreakdown}
          />

          <BreakdownChart
            title="Toppings Breakdown"
            subtitle="Nutella, chocolate, strawberry, maple, chocolate chips, Oreos, Dairy Milk, and marshmellow"
            rows={toppingsBreakdown}
          />

          <BreakdownChart
            title="Syrups Breakdown"
            subtitle="Chocolate, hazelnut, vanilla, and caramel"
            rows={syrupsBreakdown}
          />

          <BreakdownChart
            title="Ice Cream Breakdown"
            subtitle="Strawberry, vanilla, chocolate, and cookies & cream"
            rows={iceCreamBreakdown}
          />
        </section>

        <section className="grid xl:grid-cols-2 gap-5 mt-5">
          <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">Category Detail</h2>
                <p className="text-white/50 text-sm mt-1">
                  Highest spending category:{" "}
                  {biggestExpense ? biggestExpense.name : "None"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {categorySummary.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/55">
                  No expenses in selected range
                </div>
              ) : (
                categorySummary.map((row) => {
                  const percentage =
                    totalExpenses > 0
                      ? Math.round((row.value / totalExpenses) * 100)
                      : 0;

                  return (
                    <div key={row.name} className="rounded-2xl bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold">{row.name}</p>
                          <p className="text-white/50 text-sm">
                            {percentage}% of expenses
                          </p>
                        </div>
                        <p className="font-bold">{money(row.value)}</p>
                      </div>

                      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#d81b72]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[34px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">Monthly Overview</h2>
                <p className="text-white/50 text-sm mt-1">
                  Includes legacy and POS revenue
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {monthlyTrend.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/55">
                  No monthly data
                </div>
              ) : (
                monthlyTrend
                  .slice()
                  .reverse()
                  .map((row) => (
                    <div
                      key={row.month}
                      className="rounded-2xl bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold">{row.label}</p>
                        <p
                          className={`font-bold ${
                            row.profit < 0 ? "text-red-300" : "text-green-300"
                          }`}
                        >
                          {money(row.profit)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/50">Revenue</p>
                          <p className="font-bold">{money(row.revenue)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/50">Expenses</p>
                          <p className="font-bold">{money(row.expenses)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/50">Legacy Rev.</p>
                          <p className="font-bold">{money(row.legacyRevenue)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/50">POS Rev.</p>
                          <p className="font-bold">{money(row.posRevenue)}</p>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[34px] bg-[#151922] border border-white/10 p-5 mt-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-bold">Expense Entries</h2>
              <p className="text-white/50 mt-1">
                Showing expenses for selected range
              </p>
            </div>

            <p className="text-[#d81b72] font-bold">
              {filteredExpenses.length} entries
            </p>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-4 text-white/55">
              No expenses found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="rounded-2xl bg-white/5 p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-lg">
                        {categoryLabel(expense.category)}
                      </p>

                      <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-bold text-white/70">
                        {normalizeItemName(expense.item_name)}
                      </span>

                      {expense.legacy_key && (
                        <span className="rounded-full bg-[#d81b72]/15 border border-[#d81b72]/25 px-3 py-1 text-xs font-bold text-pink-200">
                          Imported
                        </span>
                      )}
                    </div>

                    <p className="text-white/50 text-sm">
                      {new Date(
                        `${expense.expense_date}T00:00:00`
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>

                    {expense.note && (
                      <p className="text-white/70 mt-2">{expense.note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold">
                      {money(Number(expense.amount))}
                    </p>

                    <button
                      onClick={() => deleteExpense(expense)}
                      className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-red-200 font-bold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[34px] bg-[#151922] border border-white/10 p-5 mt-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-bold">Legacy Revenue Entries</h2>
              <p className="text-white/50 mt-1">
                Showing imported revenue rows for selected range
              </p>
            </div>

            <p className="text-[#d81b72] font-bold">
              {filteredLegacyRevenue.length} rows
            </p>
          </div>

          {filteredLegacyRevenue.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-4 text-white/55">
              No legacy revenue found
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredLegacyRevenue.map((row) => (
                <div key={row.id} className="rounded-2xl bg-white/5 p-4">
                  <p className="text-white/50 text-sm">
                    {new Date(`${row.revenue_date}T00:00:00`).toLocaleDateString(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {money(Number(row.revenue))}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div className="rounded-xl bg-black/15 p-2">
                      <p className="text-white/45">Cash</p>
                      <p className="font-bold">{money(Number(row.cash || 0))}</p>
                    </div>
                    <div className="rounded-xl bg-black/15 p-2">
                      <p className="text-white/45">Nayapay</p>
                      <p className="font-bold">
                        {money(Number(row.nayapay || 0))}
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/15 p-2">
                      <p className="text-white/45">Meezan</p>
                      <p className="font-bold">
                        {money(Number(row.meezan || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
    "Miscellaneous",
  ],
  syrups: ["Chocolate", "Hazelnut", "Vanilla", "Caramel", "Miscellaneous"],
  ice_cream: ["Strawberry", "Vanilla", "Chocolate", "Cookies & Cream", "Mango", "Miscellaneous"],
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return `Rs. ${Math.round(value || 0).toLocaleString()}`;
}

function categoryLabel(key: string) {
  return expenseCategories.find((cat) => cat.key === key)?.label || key;
}

function normalizeItemName(value: string | null | undefined) {
  if (!value || value.trim() === "") return "Miscellaneous";
  return value.trim();
}

export default function WorkerExpensesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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

      if (profile?.role !== "worker" && profile?.role !== "admin") {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("created_by", user.id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);

      setExpenses((data || []) as Expense[]);
    } finally {
      setLoading(false);
    }
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (saving) return;

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setNotice("Enter amount");
      return;
    }

    setSaving(true);
    setNotice("Saving...");

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
        item_name: itemName || "Miscellaneous",
        amount: numericAmount,
        expense_date: expenseDate,
        note: note.trim() || null,
        created_by: user.id,
      });

      if (error) {
        setNotice("Could not save");
        return;
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "WORKER_EXPENSE_CREATED",
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

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 lg:p-6">
      {(loading || saving) && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-7 text-center">
            <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
            <h2 className="mt-4 text-2xl font-bold">
              {saving ? "Saving expense" : "Loading expenses"}
            </h2>
            <p className="mt-2 text-white/60">Please wait...</p>
          </div>
        </div>
      )}

      <div className="max-w-[1500px] mx-auto">
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
                  Add Expense
                </h1>
                <p className="text-white/60 mt-2">
                  Add expenses only. No charts or profit numbers here.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/pos"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Back
              </Link>

              <button
                onClick={logout}
                className="rounded-2xl bg-[#d81b72] px-5 py-3 font-bold text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5 lg:p-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#d81b72]">
                New Entry
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-2">
                Expense Form
              </h2>
              <p className="text-white/50 mt-1">
                Pick category, item, amount, and date.
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
                Category
              </label>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {expenseCategories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => changeCategory(cat.key)}
                    className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${
                      category === cat.key
                        ? "bg-[#d81b72] border-[#d81b72] text-white"
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
                Item
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
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[34px] bg-[#151922] border border-white/10 p-5 mt-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-bold">Your Recent Expenses</h2>
              <p className="text-white/50 mt-1">Last 20 expenses you added.</p>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-4 text-white/55">
              No expenses added yet
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
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
                    </div>

                    <p className="text-white/50 text-sm">
                      {new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>

                    {expense.note && (
                      <p className="text-white/70 mt-2">{expense.note}</p>
                    )}
                  </div>

                  <p className="text-2xl font-bold">
                    {money(Number(expense.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
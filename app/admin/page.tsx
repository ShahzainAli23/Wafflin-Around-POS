"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AdminCard = {
  href: string;
  number: string;
  title: string;
  description: string;
  cta: string;
  badgeClass: string;
  cardClass: string;
};

const adminCards: AdminCard[] = [
  {
    href: "/admin/dashboard",
    number: "1",
    title: "Dashboard",
    description:
      "Daily sales, payment split, top items, cancelled orders, recent orders, and charts.",
    cta: "Open Dashboard →",
    badgeClass: "bg-[#d81b72] text-white",
    cardClass:
      "border-white/10 bg-[#151922] shadow-[0_18px_45px_rgba(0,0,0,0.28)] hover:border-[#d81b72]/40",
  },
  {
    href: "/admin/reports",
    number: "2",
    title: "Reports",
    description:
      "Daily and monthly reports, all orders, waffles, coffee, sauces, toppings, and scoops.",
    cta: "Open Reports →",
    badgeClass: "bg-[#8b4b39] text-white",
    cardClass:
      "border-white/10 bg-[#151922] shadow-[0_18px_45px_rgba(0,0,0,0.28)] hover:border-[#d81b72]/40",
  },
  {
    href: "/admin/expenses",
    number: "3",
    title: "Expenses",
    description:
      "Add expenses, view daily and monthly costs, category breakdowns, and net profit.",
    cta: "Open Expenses →",
    badgeClass: "bg-[#f0c8d9] text-[#241814]",
    cardClass:
      "border-[#d81b72]/40 bg-[linear-gradient(135deg,#151922,#2a101d)] shadow-[0_18px_45px_rgba(216,27,114,0.18)]",
  },
  {
    href: "/admin/split",
    number: "4",
    title: "Split",
    description:
      "Monthly profit split between Fatima and Shahzain with adjustable percentages.",
    cta: "Open Split →",
    badgeClass: "bg-green-500 text-[#0f1115]",
    cardClass:
      "border-green-500/30 bg-[linear-gradient(135deg,#151922,#10251a)] shadow-[0_18px_45px_rgba(34,197,94,0.12)]",
  },
  {
    href: "/admin/usage",
    number: "5",
    title: "Usage",
    description:
      "Monthly product usage and cost from POS orders: ice cream, sauces, syrups, coffee, milk, toppings, batter, and ice.",
    cta: "Open Usage →",
    badgeClass: "bg-blue-500 text-[#0f1115]",
    cardClass:
      "border-blue-500/30 bg-[linear-gradient(135deg,#151922,#101d2b)] shadow-[0_18px_45px_rgba(59,130,246,0.12)]",
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);

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

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f1115] text-white flex items-center justify-center">
        <div className="text-center">
          <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
          <p className="mt-3 font-bold">Loading admin...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 lg:p-6">
      <div className="max-w-[1700px] mx-auto">
        <div className="rounded-[34px] border border-white/10 bg-[#151922] p-6 lg:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Wafflin' Around"
                className="h-16 w-16 object-contain rounded-2xl"
              />

              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-[#d81b72]">
                  Wafflin' Around
                </p>

                <h1 className="text-4xl lg:text-5xl font-bold mt-2">
                  Admin Panel
                </h1>

                <p className="text-white/60 mt-2">
                  Sales, reports, expenses, usage, and monthly profit split
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white hover:bg-white/5 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-5 mt-6">
          {adminCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group rounded-[34px] border p-6 hover:-translate-y-1 transition flex flex-col min-h-[310px] ${card.cardClass}`}
            >
              <div
                className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${card.badgeClass}`}
              >
                {card.number}
              </div>

              <h2 className="text-3xl font-bold mt-6">{card.title}</h2>

              <p className="text-white/60 mt-3 leading-relaxed flex-1">
                {card.description}
              </p>

              <div className="mt-8 rounded-2xl bg-white/5 p-4">
                <p className="text-[#d81b72] font-bold group-hover:text-white">
                  {card.cta}
                </p>
              </div>
            </Link>
          ))}
        </section>

        <section className="grid lg:grid-cols-4 gap-5 mt-6">
          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/50 text-sm">Daily control</p>
            <h3 className="text-2xl font-bold mt-2">Start with Dashboard</h3>
            <p className="text-white/60 mt-3">
              Use this for daily sales tracking, payment breakdowns, active
              checks, and recent order review.
            </p>
          </div>

          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/50 text-sm">Deep breakdown</p>
            <h3 className="text-2xl font-bold mt-2">Use Reports</h3>
            <p className="text-white/60 mt-3">
              Use this when you want item-level sales, daily reports, monthly
              reports, sauces, toppings, and flavor reports.
            </p>
          </div>

          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/50 text-sm">Cost control</p>
            <h3 className="text-2xl font-bold mt-2">Use Usage</h3>
            <p className="text-white/60 mt-3">
              Use this to estimate monthly product usage and cost from POS
              orders only.
            </p>
          </div>

          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/50 text-sm">Profit tracking</p>
            <h3 className="text-2xl font-bold mt-2">Expenses + Split</h3>
            <p className="text-white/60 mt-3">
              Enter costs in Expenses, then use Split to calculate Fatima and
              Shahzain’s share month by month.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Order = {
  id: string;
  order_no: number;
  total: number;
  payment_method: "cash" | "nayapay" | "meezan";
  created_at: string;
  status: "active" | "completed" | "cancelled" | string;
  is_free?: boolean | null;
  free_reason?: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  line_total: number;
};

type OrderItemOption = {
  id: string;
  order_item_id: string;
  option_name: string;
  option_group: string;
  price: number;
};

type AuditLog = {
  id: string;
  action: string;
  created_at: string;
  details: any;
};

type RangeMode = "day" | "7d" | "15d" | "1m" | "3m" | "6m";

const rangeOptions: { key: RangeMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" },
  { key: "1m", label: "1 Month" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
];

const donutColors = ["#d81b72", "#8b4b39", "#f0c8d9"];

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

  start.setDate(start.getDate() - 179);
  return { start: startOfDay(start), end };
}

function money(value: number) {
  return `Rs. ${value}`;
}

function freeReasonLabel(reason: string | null | undefined) {
  if (reason === "loyalty_free") return "Loyalty Free";
  if (reason === "shahzain_fatima") return "Shahzain/Fatima";
  if (reason === "jalal") return "Jalal";
  return "Free Order";
}

export default function AdminPage() {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemOptions, setItemOptions] = useState<OrderItemOption[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedDate, rangeMode]);

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

      const { start, end } = getRange(selectedDate, rangeMode);

      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      const safeOrders = (orderData || []) as Order[];
      setOrders(safeOrders);

      const orderIds = safeOrders.map((o) => o.id);

      if (orderIds.length > 0) {
        const { data: itemData } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);

        const safeItems = (itemData || []) as OrderItem[];
        setOrderItems(safeItems);

        const itemIds = safeItems.map((i) => i.id);

        if (itemIds.length > 0) {
          const { data: optionData } = await supabase
            .from("order_item_options")
            .select("*")
            .in("order_item_id", itemIds);

          setItemOptions((optionData || []) as OrderItemOption[]);
        } else {
          setItemOptions([]);
        }
      } else {
        setOrderItems([]);
        setItemOptions([]);
      }

      const { data: auditData } = await supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      setAudits((auditData || []) as AuditLog[]);
    } finally {
      setLoading(false);
    }
  }

  const revenueOrders = useMemo(() => {
    return orders.filter((order) => order.status !== "cancelled");
  }, [orders]);

  const cancelledOrders = useMemo(() => {
    return orders.filter((order) => order.status === "cancelled");
  }, [orders]);

  const revenueOrderIds = useMemo(() => {
    return new Set(revenueOrders.map((order) => order.id));
  }, [revenueOrders]);

  const revenueOrderItems = useMemo(() => {
    return orderItems.filter((item) => revenueOrderIds.has(item.order_id));
  }, [orderItems, revenueOrderIds]);

  const revenueItemIds = useMemo(() => {
    return new Set(revenueOrderItems.map((item) => item.id));
  }, [revenueOrderItems]);

  const revenueItemOptions = useMemo(() => {
    return itemOptions.filter((option) => revenueItemIds.has(option.order_item_id));
  }, [itemOptions, revenueItemIds]);

  const optionsByItemId = useMemo(() => {
    const map = new Map<string, OrderItemOption[]>();

    itemOptions.forEach((option) => {
      const existing = map.get(option.order_item_id) || [];
      existing.push(option);
      map.set(option.order_item_id, existing);
    });

    return map;
  }, [itemOptions]);

  const revenueOptionsByItemId = useMemo(() => {
    const map = new Map<string, OrderItemOption[]>();

    revenueItemOptions.forEach((option) => {
      const existing = map.get(option.order_item_id) || [];
      existing.push(option);
      map.set(option.order_item_id, existing);
    });

    return map;
  }, [revenueItemOptions]);

  const itemsByOrderId = useMemo(() => {
    const map = new Map<string, OrderItem[]>();

    orderItems.forEach((item) => {
      const existing = map.get(item.order_id) || [];
      existing.push(item);
      map.set(item.order_id, existing);
    });

    return map;
  }, [orderItems]);

  function getItemDisplayName(
    item: OrderItem,
    mapToUse: Map<string, OrderItemOption[]> = optionsByItemId
  ) {
    const options = mapToUse.get(item.id) || [];
    const flavorNames = options
      .filter((o) => o.option_group === "Ice Cream Flavor")
      .map((o) => o.option_name);

    if (item.product_name === "Ice Cream" && flavorNames.length > 0) {
      return `Ice Cream - ${flavorNames.join(" + ")}`;
    }

    return item.product_name;
  }

  const totalSales = useMemo(() => {
    return revenueOrders.reduce((sum, order) => sum + Number(order.total), 0);
  }, [revenueOrders]);

  const cancelledValue = useMemo(() => {
    return cancelledOrders.reduce((sum, order) => sum + Number(order.total), 0);
  }, [cancelledOrders]);

  const avgOrder = useMemo(() => {
    return revenueOrders.length ? Math.round(totalSales / revenueOrders.length) : 0;
  }, [revenueOrders, totalSales]);

  const paymentTotals = useMemo(() => {
    return {
      cash: revenueOrders
        .filter((o) => o.payment_method === "cash")
        .reduce((sum, o) => sum + Number(o.total), 0),
      nayapay: revenueOrders
        .filter((o) => o.payment_method === "nayapay")
        .reduce((sum, o) => sum + Number(o.total), 0),
      meezan: revenueOrders
        .filter((o) => o.payment_method === "meezan")
        .reduce((sum, o) => sum + Number(o.total), 0),
    };
  }, [revenueOrders]);

  const paymentChartData = [
    { name: "Cash", value: paymentTotals.cash, color: donutColors[0] },
    { name: "Nayapay", value: paymentTotals.nayapay, color: donutColors[1] },
    { name: "Meezan", value: paymentTotals.meezan, color: donutColors[2] },
  ];

  const salesChartData = useMemo(() => {
    if (rangeMode === "day") {
      const buckets = Array.from({ length: 24 }, (_, i) => ({
        label: `${String(i).padStart(2, "0")}:00`,
        sales: 0,
      }));

      revenueOrders.forEach((order) => {
        const hour = new Date(order.created_at).getHours();
        buckets[hour].sales += Number(order.total);
      });

      return buckets;
    }

    const map = new Map<string, number>();

    revenueOrders.forEach((order) => {
      const d = new Date(order.created_at);
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + Number(order.total));
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([key, sales]) => ({
        label: new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        }),
        sales,
      }));
  }, [revenueOrders, rangeMode]);

  const topItems = useMemo(() => {
    const map = new Map<string, number>();

    revenueOrderItems.forEach((item) => {
      const label = getItemDisplayName(item, revenueOptionsByItemId);
      map.set(label, (map.get(label) || 0) + item.quantity);
    });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [revenueOrderItems, revenueOptionsByItemId]);

  const topAddons = useMemo(() => {
    const map = new Map<string, number>();

    revenueItemOptions
      .filter((item) => item.option_group === "Add-on")
      .forEach((item) => {
        map.set(item.option_name, (map.get(item.option_name) || 0) + 1);
      });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [revenueItemOptions]);

  const selectedOrderItems = useMemo(() => {
    if (!selectedOrder) return [];
    return itemsByOrderId.get(selectedOrder.id) || [];
  }, [selectedOrder, itemsByOrderId]);

  async function logout() {
    if (loading) return;
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 lg:p-6">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-center">
            <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
            <h2 className="mt-4 text-2xl font-bold">Loading dashboard</h2>
            <p className="mt-2 text-white/60">Please wait...</p>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-[30px] bg-[#151922] border border-white/10 p-5 lg:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[#d81b72]">
                  Order Details
                </p>
                <h2 className="text-3xl font-bold mt-2">
                  Order #{selectedOrder.order_no}
                </h2>
                <p className="text-white/60 mt-2">
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-2 font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid md:grid-cols-4 gap-4 mt-6">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-white/55">Payment</p>
                <p className="text-xl font-bold mt-2 capitalize">
                  {selectedOrder.payment_method}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-white/55">Status</p>
                <p
                  className={`text-xl font-bold mt-2 capitalize ${
                    selectedOrder.status === "cancelled"
                      ? "text-red-300"
                      : selectedOrder.status === "completed"
                      ? "text-green-300"
                      : "text-[#d81b72]"
                  }`}
                >
                  {selectedOrder.status}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-white/55">Items</p>
                <p className="text-xl font-bold mt-2">
                  {selectedOrderItems.length}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-white/55">Total</p>
                <p className="text-xl font-bold mt-2">
                  {money(Number(selectedOrder.total))}
                </p>
              </div>
            </div>

            {selectedOrder.status === "cancelled" && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 font-bold">
                This order was cancelled and is not counted in revenue.
              </div>
            )}

            {selectedOrder.is_free && (
              <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-green-200 font-bold">
                Free order reason: {freeReasonLabel(selectedOrder.free_reason)}
              </div>
            )}

            <div className="mt-6 space-y-4">
              {selectedOrderItems.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No items found
                </div>
              ) : (
                selectedOrderItems.map((item) => {
                  const options = optionsByItemId.get(item.id) || [];

                  return (
                    <div
                      key={item.id}
                      className="rounded-[24px] bg-white/5 p-4 border border-white/8"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-bold">
                            {getItemDisplayName(item)}
                          </p>
                          <p className="text-white/55 mt-1">
                            Quantity: {item.quantity}
                          </p>
                        </div>

                        <p className="text-xl font-bold">
                          {money(Number(item.line_total))}
                        </p>
                      </div>

                      {options.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {options.map((option) => (
                            <p
                              key={option.id}
                              className="text-sm text-white/70"
                            >
                              {option.option_group}: {option.option_name}
                              {Number(option.price) > 0
                                ? ` (+ Rs. ${option.price})`
                                : ""}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="rounded-[30px] border border-white/10 bg-[#151922] p-5 lg:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
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
                  Admin Dashboard
                </h1>
                <p className="text-white/60 mt-2">
                  Revenue excludes cancelled orders
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                disabled={loading}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white"
              />

              <Link
                href="/admin"
                className="rounded-2xl bg-[#d81b72] px-5 py-3 font-bold text-white"
              >
                Back
              </Link>

              <button
                onClick={loadData}
                disabled={loading}
                className={`rounded-2xl px-5 py-3 font-bold text-white ${
                  loading
                    ? "bg-[#67565f] cursor-not-allowed"
                    : "bg-[#d81b72]"
                }`}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                onClick={logout}
                disabled={loading}
                className={`rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white ${
                  loading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                disabled={loading}
                onClick={() => setRangeMode(option.key)}
                className={`rounded-2xl px-4 py-2.5 font-bold ${
                  rangeMode === option.key
                    ? "bg-[#d81b72] text-white"
                    : "bg-white/5 text-white/80 border border-white/10"
                } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 mt-5">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#d81b72,#a10d52)] p-5 shadow-[0_15px_35px_rgba(216,27,114,0.28)]">
            <p className="text-white/80">Total Sales</p>
            <h2 className="text-4xl font-bold mt-3">{money(totalSales)}</h2>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Revenue Orders</p>
            <h2 className="text-4xl font-bold mt-3">{revenueOrders.length}</h2>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Average Order</p>
            <h2 className="text-4xl font-bold mt-3">{money(avgOrder)}</h2>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Best Payment Method</p>
            <h2 className="text-3xl font-bold mt-3">
              {
                paymentChartData.reduce(
                  (best, item) => (item.value > best.value ? item : best),
                  { name: "None", value: 0, color: "#fff" }
                ).name
              }
            </h2>
          </div>

          <div className="rounded-[28px] bg-red-500/10 border border-red-500/25 p-5">
            <p className="text-red-200">Cancelled</p>
            <h2 className="text-4xl font-bold mt-3 text-red-100">
              {cancelledOrders.length}
            </h2>
            <p className="text-red-200 mt-2 font-bold">
              {money(cancelledValue)}
            </p>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Cash</p>
            <h3 className="text-3xl font-bold mt-2">
              {money(paymentTotals.cash)}
            </h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Nayapay</p>
            <h3 className="text-3xl font-bold mt-2">
              {money(paymentTotals.nayapay)}
            </h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Meezan</p>
            <h3 className="text-3xl font-bold mt-2">
              {money(paymentTotals.meezan)}
            </h3>
          </div>
        </section>

        <section className="mt-5">
          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl lg:text-3xl font-bold">Sales Trend</h2>
              <p className="text-white/50 text-sm">
                {rangeOptions.find((r) => r.key === rangeMode)?.label}
              </p>
            </div>

            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData}>
                  <XAxis dataKey="label" stroke="#c7c7c7" />
                  <YAxis stroke="#c7c7c7" />
                  <Tooltip
                    contentStyle={{
                      background: "#0f1115",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                    }}
                  />
                  <Bar dataKey="sales" fill="#d81b72" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid xl:grid-cols-[1.2fr_0.8fr] gap-5 mt-5">
          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">Payment Split</h2>
              <p className="text-white/50 text-sm">Cash / Nayapay / Meezan</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-center">
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={75}
                      outerRadius={115}
                      paddingAngle={4}
                      label
                    >
                      {paymentChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0f1115",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 16,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {paymentChartData.map((entry) => (
                  <div
                    key={entry.name}
                    className="rounded-2xl bg-white/5 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <p className="font-bold">{entry.name}</p>
                    </div>
                    <p className="text-white/75">{money(entry.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">Top Add-ons</h2>
              <p className="text-white/50 text-sm">Paid add-ons</p>
            </div>

            <div className="space-y-3">
              {topAddons.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No data
                </div>
              ) : (
                topAddons.map((item, index) => (
                  <div
                    key={item.name}
                    className="rounded-2xl bg-white/5 px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#8b4b39] text-white flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <p className="font-bold">{item.name}</p>
                    </div>
                    <p className="text-white/70">{item.qty}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid xl:grid-cols-2 gap-5 mt-5">
          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">Top Items</h2>
              <p className="text-white/50 text-sm">
                Excludes cancelled orders
              </p>
            </div>

            <div className="space-y-3">
              {topItems.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No data
                </div>
              ) : (
                topItems.map((item, index) => (
                  <div
                    key={item.name}
                    className="rounded-2xl bg-white/5 px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#d81b72] text-white flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <p className="font-bold">{item.name}</p>
                    </div>
                    <p className="text-white/70">{item.qty}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">Recent Orders</h2>
              <p className="text-white/50 text-sm">Click to open</p>
            </div>

            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No orders found
                </div>
              ) : (
                orders.slice(0, 12).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full rounded-2xl px-4 py-3 flex items-center justify-between text-left transition ${
                      order.status === "cancelled"
                        ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/15"
                        : "bg-white/5 hover:bg-white/8"
                    }`}
                  >
                    <div>
                      <p className="font-bold">Order #{order.order_no}</p>
                      <p className="text-white/55 text-sm">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      <p
                        className={`text-sm mt-1 capitalize font-bold ${
                          order.status === "cancelled"
                            ? "text-red-300"
                            : order.status === "completed"
                            ? "text-green-300"
                            : "text-[#d81b72]"
                        }`}
                      >
                        {order.status}
                      </p>

                      {order.is_free && (
                        <p className="text-green-200 text-sm mt-1 font-bold">
                          {freeReasonLabel(order.free_reason)}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="font-bold">{money(Number(order.total))}</p>
                      <p className="text-white/55 text-sm capitalize">
                        {order.payment_method}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">Audit Log</h2>
              <p className="text-white/50 text-sm">Recent actions</p>
            </div>

            <div className="space-y-3">
              {audits.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No audit rows
                </div>
              ) : (
                audits.map((audit) => (
                  <div
                    key={audit.id}
                    className="rounded-2xl bg-white/5 px-4 py-3"
                  >
                    <p className="font-bold">{audit.action}</p>
                    <p className="text-white/55 text-sm mt-1">
                      {new Date(audit.created_at).toLocaleString()}
                    </p>
                    {audit.details?.paymentMethod ? (
                      <p className="text-white/70 text-sm mt-1">
                        Payment: {audit.details.paymentMethod}
                      </p>
                    ) : null}
                    {audit.details?.status ? (
                      <p className="text-white/70 text-sm mt-1 capitalize">
                        Status: {audit.details.status}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
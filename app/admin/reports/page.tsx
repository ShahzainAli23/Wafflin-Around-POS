"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  order_no: number;
  subtotal: number;
  discount: number;
  discount_percent?: number | null;
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
  product_id?: string | null;
  product_name: string;
  category: string;
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

type Expense = {
  id: string;
  category: string;
  item_name: string | null;
  amount: number;
  expense_date: string;
  note: string | null;
  created_at: string;
};

type Product = {
  id: string;
  category: string;
  name: string;
  variant: string | null;
  size: string | null;
  price: number;
};

type UsageComparisonRow = {
  key: string;
  label: string;
  estimatedUsageCost: number;
  actualExpense: number;
  variance: number;
};

type DaySummary = {
  dateKey: string;
  label: string;
  totalSales: number;
  legacyRevenue: number;
  posRevenue: number;
  subtotal: number;
  discount: number;
  cash: number;
  nayapay: number;
  meezan: number;
  orders: number;
  cancelledOrders: number;
  cancelledValue: number;
};

type MonthSummary = {
  monthKey: string;
  label: string;
  totalSales: number;
  legacyRevenue: number;
  posRevenue: number;
  subtotal: number;
  discount: number;
  cash: number;
  nayapay: number;
  meezan: number;
  orders: number;
  cancelledOrders: number;
  cancelledValue: number;
};

function money(value: number) {
  const rounded = Math.round(value || 0);
  const abs = Math.abs(rounded).toLocaleString();

  if (rounded < 0) {
    return `- Rs. ${abs}`;
  }

  return `Rs. ${abs}`;
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthKey(value: string) {
  return new Date(value).toISOString().slice(0, 7);
}

function formatDateLabel(key: string) {
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonthLabel(key: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function isRevenueOrder(order: Order) {
  return order.status !== "cancelled";
}

const ML_PER_ICE_CREAM_BOX = 1500;
const ICE_CREAM_BOX_COST = 1200;
const MILK_BOTTLE_ML = 1000;
const MILK_BOTTLE_COST = 380;
const SYRUP_BOTTLE_ML = 1000;
const COFFEE_SYRUP_BOTTLE_COST = 2300;
const MAPLE_BOTTLE_ML = 710;
const MAPLE_BOTTLE_COST = 2350;
const HERSHEY_CHOCOLATE_BOTTLE_ML_ESTIMATE = 500;
const HERSHEY_STRAWBERRY_BOTTLE_ML_ESTIMATE = 460;
const HERSHEY_BOTTLE_COST = 1450;
const NUTELLA_MIX_BOTTLE_ML_ESTIMATE = 1100;
const NUTELLA_MIX_BOTTLE_COST = 1375;
const OREO_BISCUITS_PER_PACKET = 4;
const OREO_PACKET_COST = 282 / 8;
const MARSHMALLOW_PACKETS_PER_BOX = 18;
const MARSHMALLOW_BOX_COST = 180;
const DAIRY_MILK_BAR_G = 56;
const DAIRY_MILK_BAR_COST = 250;
const CHOCOLATE_CHIPS_PACK_G = 100;
const CHOCOLATE_CHIPS_PACK_COST = 120;
const COFFEE_BAG_G = 1000;
const COFFEE_BAG_COST = 8100;
const ICE_BAG_G = 1500;
const ICE_BAG_COST = 91;
const COLD_COFFEE_ICE_G = 106.5;
const COLD_BREW_UNIT_COST = 715;
const FROZEN_HOT_CHOCOLATE_CRAVE_CHOCOLATE_G = 55;
const FROZEN_HOT_CHOCOLATE_MILK_ML = 200;
const FROZEN_HOT_CHOCOLATE_CREAM_G = 50;
const CREAM_PACK_G_ESTIMATE = 200;
const CREAM_PACK_COST = 250;
const CRAVE_CHOCOLATE_PACK_G_ESTIMATE = 1000;
const CRAVE_CHOCOLATE_PACK_COST = 0;
const STANDALONE_SAUCE_EXTRA_ML = 30;
const STANDALONE_CHOCOLATE_CHIPS_G = 12;
const STANDALONE_OREO_PACKETS = 1;
const STANDALONE_MARSHMALLOW_PACKETS = 1;
const STANDALONE_ICE_G = COLD_COFFEE_ICE_G;
const KITKAT_FINGERS_PER_PACK = 2;
const KITKAT_PACK_COST = 175;
const WAFFLE_ICE_CREAM_ADDON_ML = 100;

const WAFFLE_SIZE_FACTOR: Record<string, number> = {
  Small: 0.25,
  Medium: 0.5,
  Large: 1,
};

const SAUCE_ML_BY_WAFFLE_SIZE: Record<string, number> = {
  Small: 20,
  Medium: 30,
  Large: 40,
};

const OREO_BISCUITS_BY_WAFFLE_SIZE: Record<string, number> = {
  Small: 2,
  Medium: 3,
  Large: 4,
};

const DAIRY_MILK_G_BY_WAFFLE_SIZE: Record<string, number> = {
  Small: 12,
  Medium: 22,
  Large: 32,
};

const MARSHMALLOW_PACKETS_BY_WAFFLE_SIZE: Record<string, number> = {
  Small: 0.67,
  Medium: 1,
  Large: 1.33,
};

const CHOCOLATE_CHIPS_G_BY_WAFFLE_SIZE: Record<string, number> = {
  Small: 8,
  Medium: 12,
  Large: 16,
};

const KITKAT_FINGERS_BY_WAFFLE_SIZE: Record<string, number> = {
  Small: 1,
  Medium: 2,
  Large: 3,
};

const FULL_WAFFLE_RECIPE = {
  milkMl: 420,
};

function costFromPack(used: number, packSize: number, packCost: number) {
  if (!packSize || !packCost) return 0;
  return (used / packSize) * packCost;
}

function normalizeOptionName(name: string) {
  return name.trim().toLowerCase();
}

function isSauceOption(name: string) {
  const n = normalizeOptionName(name);

  return (
    n === "nutella" ||
    n === "nutella sauce" ||
    n === "chocolate" ||
    n === "chocolate sauce" ||
    n === "strawberry" ||
    n === "strawberry sauce" ||
    n === "maple" ||
    n === "maple sauce"
  );
}

function sauceUsageName(name: string) {
  const n = normalizeOptionName(name);

  if (n === "nutella" || n === "nutella sauce") return "Nutella Sauce";
  if (n === "chocolate" || n === "chocolate sauce") return "Chocolate Sauce";
  if (n === "strawberry" || n === "strawberry sauce") return "Strawberry Sauce";
  if (n === "maple" || n === "maple sauce") return "Maple Sauce";

  return name;
}

function getSauceCost(name: string, ml: number) {
  const sauceName = sauceUsageName(name);

  if (sauceName === "Nutella Sauce") {
    return costFromPack(ml, NUTELLA_MIX_BOTTLE_ML_ESTIMATE, NUTELLA_MIX_BOTTLE_COST);
  }

  if (sauceName === "Chocolate Sauce") {
    return costFromPack(ml, HERSHEY_CHOCOLATE_BOTTLE_ML_ESTIMATE, HERSHEY_BOTTLE_COST);
  }

  if (sauceName === "Strawberry Sauce") {
    return costFromPack(ml, HERSHEY_STRAWBERRY_BOTTLE_ML_ESTIMATE, HERSHEY_BOTTLE_COST);
  }

  if (sauceName === "Maple Sauce") {
    return costFromPack(ml, MAPLE_BOTTLE_ML, MAPLE_BOTTLE_COST);
  }

  return 0;
}

function addEstimate(map: Map<string, UsageComparisonRow>, key: string, label: string, cost: number) {
  const existing =
    map.get(key) ||
    ({
      key,
      label,
      estimatedUsageCost: 0,
      actualExpense: 0,
      variance: 0,
    } satisfies UsageComparisonRow);

  existing.estimatedUsageCost += Number(cost || 0);
  map.set(key, existing);
}

function buildUsageEstimateRows(
  items: OrderItem[],
  optionsByItemId: Map<string, OrderItemOption[]>,
  productsById: Map<string, Product>
) {
  const map = new Map<string, UsageComparisonRow>();

  items.forEach((item) => {
    const product = item.product_id ? productsById.get(item.product_id) : null;
    const category = product?.category || item.category;
    const name = product?.name || item.product_name;
    const size = product?.size || null;
    const variant = product?.variant || null;
    const quantity = Number(item.quantity || 1);
    const options = optionsByItemId.get(item.id) || [];

    if (category === "Cold Brew" || name === "Cold Brew") {
      addEstimate(map, "coffee", "Coffee / Cold Brew", quantity * COLD_BREW_UNIT_COST);
    }

    if (category === "Extras") {
      if (name === "Oreos") {
        addEstimate(map, "toppings", "Toppings + Sauces", quantity * STANDALONE_OREO_PACKETS * OREO_PACKET_COST);
      }

      if (name === "Dairy Milk") {
        addEstimate(map, "toppings", "Toppings + Sauces", quantity * DAIRY_MILK_BAR_COST);
      }

      if (["Nutella", "Chocolate", "Strawberry", "Maple"].includes(name)) {
        addEstimate(map, "toppings", "Toppings + Sauces", getSauceCost(name, quantity * STANDALONE_SAUCE_EXTRA_ML));
      }

      if (name === "Chocolate Chips") {
        addEstimate(
          map,
          "toppings",
          "Toppings + Sauces",
          costFromPack(quantity * STANDALONE_CHOCOLATE_CHIPS_G, CHOCOLATE_CHIPS_PACK_G, CHOCOLATE_CHIPS_PACK_COST)
        );
      }

      if (name === "Marshmellow") {
        addEstimate(
          map,
          "toppings",
          "Toppings + Sauces",
          costFromPack(quantity * STANDALONE_MARSHMALLOW_PACKETS, MARSHMALLOW_PACKETS_PER_BOX, MARSHMALLOW_BOX_COST)
        );
      }

      if (name === "Ice") {
        addEstimate(map, "ice", "Ice", costFromPack(quantity * STANDALONE_ICE_G, ICE_BAG_G, ICE_BAG_COST));
      }
    }

    if (category === "Waffles") {
      const factor = WAFFLE_SIZE_FACTOR[size || ""] || 1;
      const sauceMl = SAUCE_ML_BY_WAFFLE_SIZE[size || ""] || 30;
      const oreoBiscuits = OREO_BISCUITS_BY_WAFFLE_SIZE[size || ""] || 3;
      const dairyMilkG = DAIRY_MILK_G_BY_WAFFLE_SIZE[size || ""] || 22;
      const marshmallowPackets = MARSHMALLOW_PACKETS_BY_WAFFLE_SIZE[size || ""] || 1;
      const chocolateChipsG = CHOCOLATE_CHIPS_G_BY_WAFFLE_SIZE[size || ""] || 12;

      addEstimate(map, "milk", "Milk", costFromPack(FULL_WAFFLE_RECIPE.milkMl * factor * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));

      if (name === "Kit Kat Waffle") {
        const kitkatFingers = KITKAT_FINGERS_BY_WAFFLE_SIZE[size || ""] || 2;
        addEstimate(map, "toppings", "Toppings + Sauces", costFromPack(kitkatFingers * quantity, KITKAT_FINGERS_PER_PACK, KITKAT_PACK_COST));
        addEstimate(map, "toppings", "Toppings + Sauces", getSauceCost("Nutella Sauce", sauceMl * quantity));
      }

      options.forEach((option) => {
        const optionName = option.option_name;

        if (isSauceOption(optionName)) {
          addEstimate(map, "toppings", "Toppings + Sauces", getSauceCost(optionName, sauceMl * quantity));
          return;
        }

        if (optionName === "Oreos") {
          addEstimate(map, "toppings", "Toppings + Sauces", costFromPack(oreoBiscuits * quantity, OREO_BISCUITS_PER_PACKET, OREO_PACKET_COST));
          return;
        }

        if (optionName === "Dairy Milk") {
          addEstimate(map, "toppings", "Toppings + Sauces", costFromPack(dairyMilkG * quantity, DAIRY_MILK_BAR_G, DAIRY_MILK_BAR_COST));
          return;
        }

        if (optionName === "Marshmallows") {
          addEstimate(map, "toppings", "Toppings + Sauces", costFromPack(marshmallowPackets * quantity, MARSHMALLOW_PACKETS_PER_BOX, MARSHMALLOW_BOX_COST));
          return;
        }

        if (optionName === "Chocolate Chips") {
          addEstimate(map, "toppings", "Toppings + Sauces", costFromPack(chocolateChipsG * quantity, CHOCOLATE_CHIPS_PACK_G, CHOCOLATE_CHIPS_PACK_COST));
          return;
        }

        if (optionName === "Ice Cream Scoop") {
          addEstimate(map, "ice_cream", "Ice Cream", costFromPack(WAFFLE_ICE_CREAM_ADDON_ML * quantity, ML_PER_ICE_CREAM_BOX, ICE_CREAM_BOX_COST));
        }
      });
    }

    if (category === "Ice Cream Shakes") {
      const iceCreamMl = size === "Large" ? 400 : 300;
      const milkMl = size === "Large" ? 70 : 50;

      addEstimate(map, "ice_cream", "Ice Cream", costFromPack(iceCreamMl * quantity, ML_PER_ICE_CREAM_BOX, ICE_CREAM_BOX_COST));
      addEstimate(map, "milk", "Milk", costFromPack(milkMl * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));
    }

    if (category === "Ice Cream") {
      options
        .filter((option) => option.option_group === "Ice Cream Flavor")
        .forEach(() => {
          addEstimate(map, "ice_cream", "Ice Cream", costFromPack(100 * quantity, ML_PER_ICE_CREAM_BOX, ICE_CREAM_BOX_COST));
        });
    }

    if (category === "Drinks") {
      const lowerName = name.toLowerCase();
      const isHotChocolate = lowerName === "hot chocolate" || lowerName === "nutella hot chocolate";
      const isFrozenHotChocolate = lowerName === "frozen hot chocolate";

      if (isFrozenHotChocolate) {
        addEstimate(map, "frozen_hot_chocolate", "Frozen Hot Chocolate Ingredients", costFromPack(FROZEN_HOT_CHOCOLATE_CREAM_G * quantity, CREAM_PACK_G_ESTIMATE, CREAM_PACK_COST));
        addEstimate(map, "frozen_hot_chocolate", "Frozen Hot Chocolate Ingredients", costFromPack(FROZEN_HOT_CHOCOLATE_CRAVE_CHOCOLATE_G * quantity, CRAVE_CHOCOLATE_PACK_G_ESTIMATE, CRAVE_CHOCOLATE_PACK_COST));
        addEstimate(map, "milk", "Milk", costFromPack(FROZEN_HOT_CHOCOLATE_MILK_ML * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));
        addEstimate(map, "ice", "Ice", costFromPack(COLD_COFFEE_ICE_G * quantity, ICE_BAG_G, ICE_BAG_COST));
      }

      if (!isHotChocolate && !isFrozenHotChocolate) {
        const coffeeG = lowerName.includes("cappuccino") ? 16 : 12;
        addEstimate(map, "coffee", "Coffee / Cold Brew", costFromPack(coffeeG * quantity, COFFEE_BAG_G, COFFEE_BAG_COST));
      }

      if (variant === "Cold" && !isFrozenHotChocolate) {
        addEstimate(map, "milk", "Milk", costFromPack(180 * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));
        addEstimate(map, "ice", "Ice", costFromPack(COLD_COFFEE_ICE_G * quantity, ICE_BAG_G, ICE_BAG_COST));
      }

      if (variant === "Hot" && lowerName.includes("cappuccino")) {
        addEstimate(map, "milk", "Milk", costFromPack(140 * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));
      }

      if (variant === "Hot" && lowerName.includes("latte") && !lowerName.includes("cappuccino")) {
        addEstimate(map, "milk", "Milk", costFromPack(180 * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));
      }

      if (isHotChocolate) {
        addEstimate(map, "milk", "Milk", costFromPack(200 * quantity, MILK_BOTTLE_ML, MILK_BOTTLE_COST));
      }

      if (lowerName === "nutella hot chocolate") {
        addEstimate(map, "toppings", "Toppings + Sauces", getSauceCost("Nutella Sauce", 40 * quantity));
      }

      if (lowerName.includes("hazelnut")) {
        addEstimate(map, "syrups", "Syrups", costFromPack((variant === "Cold" ? 20 : 10) * quantity, SYRUP_BOTTLE_ML, COFFEE_SYRUP_BOTTLE_COST));
      }

      if (lowerName.includes("caramel")) {
        addEstimate(map, "syrups", "Syrups", costFromPack((variant === "Cold" ? 25 : 10) * quantity, SYRUP_BOTTLE_ML, COFFEE_SYRUP_BOTTLE_COST));
      }

      if (lowerName.includes("vanilla")) {
        addEstimate(map, "syrups", "Syrups", costFromPack((variant === "Cold" ? 25 : 10) * quantity, SYRUP_BOTTLE_ML, COFFEE_SYRUP_BOTTLE_COST));
      }

      if (lowerName.includes("mocha")) {
        addEstimate(map, "syrups", "Syrups", costFromPack((variant === "Cold" ? 30 : 10) * quantity, SYRUP_BOTTLE_ML, COFFEE_SYRUP_BOTTLE_COST));
      }
    }
  });

  return map;
}

function expenseComparisonKey(expense: Expense) {
  if (expense.category === "ice_cream") return "ice_cream";
  if (expense.category === "milk") return "milk";
  if (expense.category === "coffee") return "coffee";
  if (expense.category === "syrups") return "syrups";
  if (expense.category === "toppings") return "toppings";
  if (expense.category === "ice") return "ice";
  if (expense.category === "packaging") return "packaging";

  const item = (expense.item_name || "").trim().toLowerCase();

  if (expense.category === "imtiaz" && (item === "cream" || item === "crave chocolate")) {
    return "frozen_hot_chocolate";
  }

  return "other";
}

function comparisonLabel(key: string) {
  if (key === "ice_cream") return "Ice Cream";
  if (key === "milk") return "Milk";
  if (key === "coffee") return "Coffee / Cold Brew";
  if (key === "syrups") return "Syrups";
  if (key === "toppings") return "Toppings + Sauces";
  if (key === "ice") return "Ice";
  if (key === "packaging") return "Packaging Extras";
  if (key === "frozen_hot_chocolate") return "Frozen Hot Chocolate Ingredients";
  return "Other Expenses";
}

function freeReasonLabel(reason: string | null | undefined) {
  if (reason === "loyalty_free") return "Loyalty Free";
  if (reason === "shahzain_fatima") return "Shahzain/Fatima";
  if (reason === "jalal") return "Jalal";
  return "Free Order";
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemOptions, setItemOptions] = useState<OrderItemOption[]>([]);
  const [legacyRevenue, setLegacyRevenue] = useState<LegacyRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
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

      const { data: productData } = await supabase
        .from("products")
        .select("id, category, name, variant, size, price");

      setProducts((productData || []) as Product[]);

      const { data: expenseData } = await supabase
        .from("expenses")
        .select("id, category, item_name, amount, expense_date, note, created_at")
        .order("expense_date", { ascending: false });

      setExpenses((expenseData || []) as Expense[]);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (orderError) {
        setOrders([]);
        setOrderItems([]);
        setItemOptions([]);
        setLegacyRevenue([]);
        setExpenses([]);
        setProducts([]);
        return;
      }

      const safeOrders = (orderData || []) as Order[];
      setOrders(safeOrders);

      const orderIds = safeOrders.map((order) => order.id);

      if (orderIds.length === 0) {
        setOrderItems([]);
        setItemOptions([]);
      } else {
        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);

        if (itemError) {
          setOrderItems([]);
          setItemOptions([]);
        } else {
          const safeItems = (itemData || []) as OrderItem[];
          setOrderItems(safeItems);

          const itemIds = safeItems.map((item) => item.id);

          if (itemIds.length === 0) {
            setItemOptions([]);
          } else {
            const { data: optionData, error: optionError } = await supabase
              .from("order_item_options")
              .select("*")
              .in("order_item_id", itemIds);

            if (optionError) {
              setItemOptions([]);
            } else {
              setItemOptions((optionData || []) as OrderItemOption[]);
            }
          }
        }
      }

      const { data: legacyRevenueData, error: legacyRevenueError } =
        await supabase
          .from("legacy_revenue")
          .select("*")
          .order("revenue_date", { ascending: false });

      if (legacyRevenueError) {
        setLegacyRevenue([]);
      } else {
        setLegacyRevenue((legacyRevenueData || []) as LegacyRevenue[]);
      }
    } finally {
      setLoading(false);
    }
  }

  const ordersById = useMemo(() => {
    const map = new Map<string, Order>();

    orders.forEach((order) => {
      map.set(order.id, order);
    });

    return map;
  }, [orders]);

  const itemsByOrderId = useMemo(() => {
    const map = new Map<string, OrderItem[]>();

    orderItems.forEach((item) => {
      const existing = map.get(item.order_id) || [];
      existing.push(item);
      map.set(item.order_id, existing);
    });

    return map;
  }, [orderItems]);

  const optionsByItemId = useMemo(() => {
    const map = new Map<string, OrderItemOption[]>();

    itemOptions.forEach((option) => {
      const existing = map.get(option.order_item_id) || [];
      existing.push(option);
      map.set(option.order_item_id, existing);
    });

    return map;
  }, [itemOptions]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();

    products.forEach((product) => {
      map.set(product.id, product);
    });

    return map;
  }, [products]);

  const dailySummaries = useMemo(() => {
    const map = new Map<string, DaySummary>();

    orders.forEach((order) => {
      const key = dateKey(order.created_at);

      const existing =
        map.get(key) ||
        ({
          dateKey: key,
          label: formatDateLabel(key),
          totalSales: 0,
          legacyRevenue: 0,
          posRevenue: 0,
          subtotal: 0,
          discount: 0,
          cash: 0,
          nayapay: 0,
          meezan: 0,
          orders: 0,
          cancelledOrders: 0,
          cancelledValue: 0,
        } satisfies DaySummary);

      if (order.status === "cancelled") {
        existing.cancelledOrders += 1;
        existing.cancelledValue += Number(order.total || 0);
      } else {
        existing.orders += 1;
        existing.totalSales += Number(order.total || 0);
        existing.posRevenue += Number(order.total || 0);
        existing.subtotal += Number(order.subtotal || 0);
        existing.discount += Number(order.discount || 0);

        if (order.payment_method === "cash") {
          existing.cash += Number(order.total || 0);
        }

        if (order.payment_method === "nayapay") {
          existing.nayapay += Number(order.total || 0);
        }

        if (order.payment_method === "meezan") {
          existing.meezan += Number(order.total || 0);
        }
      }

      map.set(key, existing);
    });

    legacyRevenue.forEach((row) => {
      const key = row.revenue_date;

      const existing =
        map.get(key) ||
        ({
          dateKey: key,
          label: formatDateLabel(key),
          totalSales: 0,
          legacyRevenue: 0,
          posRevenue: 0,
          subtotal: 0,
          discount: 0,
          cash: 0,
          nayapay: 0,
          meezan: 0,
          orders: 0,
          cancelledOrders: 0,
          cancelledValue: 0,
        } satisfies DaySummary);

      existing.totalSales += Number(row.revenue || 0);
      existing.legacyRevenue += Number(row.revenue || 0);
      existing.cash += Number(row.cash || 0);
      existing.nayapay += Number(row.nayapay || 0);
      existing.meezan += Number(row.meezan || 0);

      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.dateKey < b.dateKey ? 1 : -1
    );
  }, [orders, legacyRevenue]);

  const monthlySummaries = useMemo(() => {
    const map = new Map<string, MonthSummary>();

    orders.forEach((order) => {
      const key = monthKey(order.created_at);

      const existing =
        map.get(key) ||
        ({
          monthKey: key,
          label: formatMonthLabel(key),
          totalSales: 0,
          legacyRevenue: 0,
          posRevenue: 0,
          subtotal: 0,
          discount: 0,
          cash: 0,
          nayapay: 0,
          meezan: 0,
          orders: 0,
          cancelledOrders: 0,
          cancelledValue: 0,
        } satisfies MonthSummary);

      if (order.status === "cancelled") {
        existing.cancelledOrders += 1;
        existing.cancelledValue += Number(order.total || 0);
      } else {
        existing.orders += 1;
        existing.totalSales += Number(order.total || 0);
        existing.posRevenue += Number(order.total || 0);
        existing.subtotal += Number(order.subtotal || 0);
        existing.discount += Number(order.discount || 0);

        if (order.payment_method === "cash") {
          existing.cash += Number(order.total || 0);
        }

        if (order.payment_method === "nayapay") {
          existing.nayapay += Number(order.total || 0);
        }

        if (order.payment_method === "meezan") {
          existing.meezan += Number(order.total || 0);
        }
      }

      map.set(key, existing);
    });

    legacyRevenue.forEach((row) => {
      const key = row.revenue_date.slice(0, 7);

      const existing =
        map.get(key) ||
        ({
          monthKey: key,
          label: formatMonthLabel(key),
          totalSales: 0,
          legacyRevenue: 0,
          posRevenue: 0,
          subtotal: 0,
          discount: 0,
          cash: 0,
          nayapay: 0,
          meezan: 0,
          orders: 0,
          cancelledOrders: 0,
          cancelledValue: 0,
        } satisfies MonthSummary);

      existing.totalSales += Number(row.revenue || 0);
      existing.legacyRevenue += Number(row.revenue || 0);
      existing.cash += Number(row.cash || 0);
      existing.nayapay += Number(row.nayapay || 0);
      existing.meezan += Number(row.meezan || 0);

      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.monthKey < b.monthKey ? 1 : -1
    );
  }, [orders, legacyRevenue]);

  const selectedDayOrders = useMemo(() => {
    if (!selectedDate) return [];

    return orders
      .filter((order) => dateKey(order.created_at) === selectedDate)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [orders, selectedDate]);

  const selectedMonthOrders = useMemo(() => {
    if (!selectedMonth) return [];

    return orders
      .filter((order) => monthKey(order.created_at) === selectedMonth)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [orders, selectedMonth]);

  const focusedOrders = useMemo(() => {
    if (viewMode === "daily") return selectedDayOrders;
    return selectedMonthOrders;
  }, [viewMode, selectedDayOrders, selectedMonthOrders]);

  const focusedLegacyRevenue = useMemo(() => {
    if (viewMode === "daily") {
      if (!selectedDate) return [];
      return legacyRevenue.filter((row) => row.revenue_date === selectedDate);
    }

    if (!selectedMonth) return [];

    return legacyRevenue.filter(
      (row) => row.revenue_date.slice(0, 7) === selectedMonth
    );
  }, [legacyRevenue, selectedDate, selectedMonth, viewMode]);

  const focusedExpenses = useMemo(() => {
    if (viewMode === "daily") {
      if (!selectedDate) return [];
      return expenses.filter((expense) => expense.expense_date === selectedDate);
    }

    if (!selectedMonth) return [];

    return expenses.filter((expense) => expense.expense_date.slice(0, 7) === selectedMonth);
  }, [expenses, selectedDate, selectedMonth, viewMode]);

  const focusedRevenueOrders = useMemo(() => {
    return focusedOrders.filter(isRevenueOrder);
  }, [focusedOrders]);

  const focusedRevenueOrderIds = useMemo(() => {
    return new Set(focusedRevenueOrders.map((order) => order.id));
  }, [focusedRevenueOrders]);

  const focusedAllOrderIds = useMemo(() => {
    return new Set(focusedOrders.map((order) => order.id));
  }, [focusedOrders]);

  const focusedRevenueItems = useMemo(() => {
    return orderItems.filter((item) =>
      focusedRevenueOrderIds.has(item.order_id)
    );
  }, [orderItems, focusedRevenueOrderIds]);

  const focusedAllItems = useMemo(() => {
    return orderItems.filter((item) => focusedAllOrderIds.has(item.order_id));
  }, [orderItems, focusedAllOrderIds]);

  const focusedRevenueItemIds = useMemo(() => {
    return new Set(focusedRevenueItems.map((item) => item.id));
  }, [focusedRevenueItems]);

  const focusedRevenueOptions = useMemo(() => {
    return itemOptions.filter((option) =>
      focusedRevenueItemIds.has(option.order_item_id)
    );
  }, [itemOptions, focusedRevenueItemIds]);

  const focusedTotals = useMemo(() => {
    const posRevenue = focusedRevenueOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

    const legacyTotal = focusedLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.revenue || 0),
      0
    );

    const revenue = posRevenue + legacyTotal;

    const subtotal = focusedRevenueOrders.reduce(
      (sum, order) => sum + Number(order.subtotal || 0),
      0
    );

    const discount = focusedRevenueOrders.reduce(
      (sum, order) => sum + Number(order.discount || 0),
      0
    );

    const cancelledOrders = focusedOrders.filter(
      (order) => order.status === "cancelled"
    );

    const cancelledValue = cancelledOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

    const posCash = focusedRevenueOrders
      .filter((order) => order.payment_method === "cash")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const posNayapay = focusedRevenueOrders
      .filter((order) => order.payment_method === "nayapay")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const posMeezan = focusedRevenueOrders
      .filter((order) => order.payment_method === "meezan")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const legacyCash = focusedLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.cash || 0),
      0
    );

    const legacyNayapay = focusedLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.nayapay || 0),
      0
    );

    const legacyMeezan = focusedLegacyRevenue.reduce(
      (sum, row) => sum + Number(row.meezan || 0),
      0
    );

    return {
      revenue,
      posRevenue,
      legacyRevenue: legacyTotal,
      subtotal,
      discount,
      orderCount: focusedRevenueOrders.length,
      legacyRows: focusedLegacyRevenue.length,
      cancelledCount: cancelledOrders.length,
      cancelledValue,
      cash: posCash + legacyCash,
      nayapay: posNayapay + legacyNayapay,
      meezan: posMeezan + legacyMeezan,
    };
  }, [focusedRevenueOrders, focusedOrders, focusedLegacyRevenue]);

  const waffleSummary = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();

    focusedRevenueItems.forEach((item) => {
      if (item.category !== "Waffles") return;

      const existing = map.get(item.product_name) || { qty: 0, value: 0 };

      existing.qty += Number(item.quantity || 0);
      existing.value += Number(item.line_total || 0);

      map.set(item.product_name, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueItems]);

  const coffeeSummary = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();

    focusedRevenueItems.forEach((item) => {
      if (item.category !== "Drinks") return;

      const existing = map.get(item.product_name) || { qty: 0, value: 0 };

      existing.qty += Number(item.quantity || 0);
      existing.value += Number(item.line_total || 0);

      map.set(item.product_name, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueItems]);

  const shakeSummary = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();

    focusedRevenueItems.forEach((item) => {
      if (item.category !== "Ice Cream Shakes") return;

      const existing = map.get(item.product_name) || { qty: 0, value: 0 };

      existing.qty += Number(item.quantity || 0);
      existing.value += Number(item.line_total || 0);

      map.set(item.product_name, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueItems]);

  const iceCreamItemSummary = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();

    focusedRevenueItems.forEach((item) => {
      if (item.category !== "Ice Cream") return;

      const existing = map.get(item.product_name) || { qty: 0, value: 0 };

      existing.qty += Number(item.quantity || 0);
      existing.value += Number(item.line_total || 0);

      map.set(item.product_name, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueItems]);

  const flavorScoopSummary = useMemo(() => {
    const map = new Map<string, number>();

    focusedRevenueOptions
      .filter((option) => option.option_group === "Ice Cream Flavor")
      .forEach((option) => {
        map.set(option.option_name, (map.get(option.option_name) || 0) + 1);
      });

    return Array.from(map.entries())
      .map(([name, scoops]) => ({ name, scoops }))
      .sort((a, b) => b.scoops - a.scoops);
  }, [focusedRevenueOptions]);

  const sauceSummary = useMemo(() => {
    const map = new Map<string, number>();

    focusedRevenueOptions
      .filter((option) => option.option_group === "Free Sauce")
      .forEach((option) => {
        map.set(option.option_name, (map.get(option.option_name) || 0) + 1);
      });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueOptions]);

  const toppingSummary = useMemo(() => {
    const map = new Map<string, number>();

    focusedRevenueOptions
      .filter((option) => option.option_group === "Free Topping")
      .forEach((option) => {
        map.set(option.option_name, (map.get(option.option_name) || 0) + 1);
      });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueOptions]);

  const addonSummary = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();

    focusedRevenueOptions
      .filter((option) => option.option_group === "Add-on")
      .forEach((option) => {
        const existing = map.get(option.option_name) || { qty: 0, value: 0 };

        existing.qty += 1;
        existing.value += Number(option.price || 0);

        map.set(option.option_name, existing);
      });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [focusedRevenueOptions]);


  const usageComparisonRows = useMemo(() => {
    const estimateMap = buildUsageEstimateRows(
      focusedRevenueItems,
      optionsByItemId,
      productsById
    );

    focusedExpenses.forEach((expense) => {
      const key = expenseComparisonKey(expense);
      const label = comparisonLabel(key);
      const existing =
        estimateMap.get(key) ||
        ({
          key,
          label,
          estimatedUsageCost: 0,
          actualExpense: 0,
          variance: 0,
        } satisfies UsageComparisonRow);

      existing.actualExpense += Number(expense.amount || 0);
      estimateMap.set(key, existing);
    });

    return Array.from(estimateMap.values())
      .map((row) => ({
        ...row,
        estimatedUsageCost: Math.round(row.estimatedUsageCost),
        actualExpense: Math.round(row.actualExpense),
        variance: Math.round(row.actualExpense - row.estimatedUsageCost),
      }))
      .sort((a, b) => {
        const aTotal = Math.max(a.actualExpense, a.estimatedUsageCost);
        const bTotal = Math.max(b.actualExpense, b.estimatedUsageCost);
        return bTotal - aTotal;
      });
  }, [focusedRevenueItems, optionsByItemId, productsById, focusedExpenses]);

  const usageComparisonTotals = useMemo(() => {
    return usageComparisonRows.reduce(
      (totals, row) => ({
        estimated: totals.estimated + row.estimatedUsageCost,
        actual: totals.actual + row.actualExpense,
        variance: totals.variance + row.variance,
      }),
      { estimated: 0, actual: 0, variance: 0 }
    );
  }, [usageComparisonRows]);

  function getItemDisplayName(item: OrderItem) {
    const options = optionsByItemId.get(item.id) || [];

    const flavorNames = options
      .filter((option) => option.option_group === "Ice Cream Flavor")
      .map((option) => option.option_name);

    if (item.product_name === "Ice Cream" && flavorNames.length > 0) {
      return `Ice Cream - ${flavorNames.join(" + ")}`;
    }

    return item.product_name;
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function ReportTable({
    title,
    subtitle,
    rows,
    valueLabel = "Value",
  }: {
    title: string;
    subtitle?: string;
    rows: { name: string; qty?: number; scoops?: number; value?: number }[];
    valueLabel?: string;
  }) {
    return (
      <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            {subtitle && <p className="text-white/50 text-sm mt-1">{subtitle}</p>}
          </div>
          <p className="text-[#d81b72] font-bold">{rows.length}</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white/5 p-4 text-white/55">
            No POS item data
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.name}
                className="rounded-2xl bg-white/5 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold">{row.name}</p>
                  <p className="text-white/50 text-sm">
                    {typeof row.scoops === "number"
                      ? `${row.scoops} scoops`
                      : `${row.qty || 0} sold`}
                  </p>
                </div>

                {typeof row.value === "number" && (
                  <div className="text-right">
                    <p className="text-white/50 text-xs">{valueLabel}</p>
                    <p className="font-bold">{money(row.value)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 lg:p-6">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-center">
            <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
            <h2 className="mt-4 text-2xl font-bold">Loading reports</h2>
            <p className="mt-2 text-white/60">Please wait...</p>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto">
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
                  Reports
                </h1>
                <p className="text-white/60 mt-2">
                  Daily, monthly, item, flavor, sauce, topping and add-on
                  breakdowns. Revenue includes legacy revenue plus live POS
                  orders.
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
                onClick={loadReports}
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

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setViewMode("daily")}
              className={`rounded-2xl px-5 py-3 font-bold ${
                viewMode === "daily"
                  ? "bg-[#d81b72] text-white"
                  : "bg-white/5 text-white border border-white/10"
              }`}
            >
              Daily Reports
            </button>

            <button
              onClick={() => setViewMode("monthly")}
              className={`rounded-2xl px-5 py-3 font-bold ${
                viewMode === "monthly"
                  ? "bg-[#d81b72] text-white"
                  : "bg-white/5 text-white border border-white/10"
              }`}
            >
              Monthly Reports
            </button>
          </div>
        </div>

        {viewMode === "daily" && (
          <section className="mt-5">
            <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold">
                    Daily End-of-Day Balances
                  </h2>
                  <p className="text-white/50 mt-1">
                    Click any day to open full report
                  </p>
                </div>
                <p className="text-[#d81b72] font-bold">
                  {dailySummaries.length} days
                </p>
              </div>

              {dailySummaries.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No daily records found
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {dailySummaries.map((day) => (
                    <button
                      key={day.dateKey}
                      onClick={() => {
                        setSelectedDate(day.dateKey);
                        setViewMode("daily");
                      }}
                      className={`rounded-[24px] p-5 text-left border transition ${
                        selectedDate === day.dateKey
                          ? "bg-[#d81b72] border-[#d81b72]"
                          : "bg-white/5 border-white/10 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white/60 text-sm">{day.label}</p>
                          <h3 className="text-3xl font-bold mt-2">
                            {money(day.totalSales)}
                          </h3>
                        </div>

                        <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
                          {day.orders} POS orders
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Legacy</p>
                          <p className="font-bold">
                            {money(day.legacyRevenue)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">POS</p>
                          <p className="font-bold">{money(day.posRevenue)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Cash</p>
                          <p className="font-bold">{money(day.cash)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Nayapay</p>
                          <p className="font-bold">{money(day.nayapay)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Meezan</p>
                          <p className="font-bold">{money(day.meezan)}</p>
                        </div>
                      </div>

                      {day.cancelledOrders > 0 && (
                        <p className="mt-4 text-red-200 font-bold text-sm">
                          Cancelled: {day.cancelledOrders} orders |{" "}
                          {money(day.cancelledValue)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {viewMode === "monthly" && (
          <section className="mt-5">
            <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold">Monthly Balances</h2>
                  <p className="text-white/50 mt-1">
                    Click any month to open full report
                  </p>
                </div>
                <p className="text-[#d81b72] font-bold">
                  {monthlySummaries.length} months
                </p>
              </div>

              {monthlySummaries.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                  No monthly records found
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {monthlySummaries.map((month) => (
                    <button
                      key={month.monthKey}
                      onClick={() => {
                        setSelectedMonth(month.monthKey);
                        setViewMode("monthly");
                      }}
                      className={`rounded-[24px] p-5 text-left border transition ${
                        selectedMonth === month.monthKey
                          ? "bg-[#d81b72] border-[#d81b72]"
                          : "bg-white/5 border-white/10 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white/60 text-sm">{month.label}</p>
                          <h3 className="text-3xl font-bold mt-2">
                            {money(month.totalSales)}
                          </h3>
                        </div>

                        <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
                          {month.orders} POS orders
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Legacy</p>
                          <p className="font-bold">
                            {money(month.legacyRevenue)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">POS</p>
                          <p className="font-bold">{money(month.posRevenue)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Cash</p>
                          <p className="font-bold">{money(month.cash)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Nayapay</p>
                          <p className="font-bold">{money(month.nayapay)}</p>
                        </div>
                        <div className="rounded-xl bg-black/15 p-3">
                          <p className="text-white/55">Meezan</p>
                          <p className="font-bold">{money(month.meezan)}</p>
                        </div>
                      </div>

                      {month.cancelledOrders > 0 && (
                        <p className="mt-4 text-red-200 font-bold text-sm">
                          Cancelled: {month.cancelledOrders} orders |{" "}
                          {money(month.cancelledValue)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {(viewMode === "daily" && selectedDate) ||
        (viewMode === "monthly" && selectedMonth) ? (
          <>
            <section className="grid md:grid-cols-2 xl:grid-cols-7 gap-4 mt-5">
              <div className="rounded-[28px] bg-[linear-gradient(135deg,#d81b72,#a10d52)] p-5 xl:col-span-2">
                <p className="text-white/75">Selected Report</p>
                <h2 className="text-3xl font-bold mt-2">
                  {viewMode === "daily"
                    ? formatDateLabel(selectedDate)
                    : formatMonthLabel(selectedMonth)}
                </h2>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">Revenue</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.revenue)}
                </h3>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">Legacy</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.legacyRevenue)}
                </h3>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">POS</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.posRevenue)}
                </h3>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">POS Orders</p>
                <h3 className="text-3xl font-bold mt-2">
                  {focusedTotals.orderCount}
                </h3>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">Discount</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.discount)}
                </h3>
              </div>

              <div className="rounded-[28px] bg-red-500/10 border border-red-500/25 p-5">
                <p className="text-red-200">Cancelled</p>
                <h3 className="text-3xl font-bold mt-2 text-red-100">
                  {focusedTotals.cancelledCount}
                </h3>
                <p className="text-red-200 font-bold">
                  {money(focusedTotals.cancelledValue)}
                </p>
              </div>
            </section>

            <section className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">Cash</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.cash)}
                </h3>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">Nayapay</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.nayapay)}
                </h3>
              </div>

              <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
                <p className="text-white/60">Meezan</p>
                <h3 className="text-3xl font-bold mt-2">
                  {money(focusedTotals.meezan)}
                </h3>
              </div>
            </section>


            <section className="mt-5 rounded-[30px] bg-[#151922] border border-white/10 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-bold">Usage Cost vs Expenses</h2>
                  <p className="text-white/50 mt-1">
                    Compares estimated POS usage cost with actual expenses entered for the selected {viewMode === "daily" ? "day" : "month"}.
                    Legacy revenue has no item-level usage, so this uses POS orders only.
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 w-full lg:w-auto">
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <p className="text-white/50 text-sm">Estimated Usage</p>
                    <p className="text-xl font-bold text-green-200">
                      {money(usageComparisonTotals.estimated)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <p className="text-white/50 text-sm">Actual Expenses</p>
                    <p className="text-xl font-bold text-pink-100">
                      {money(usageComparisonTotals.actual)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <p className="text-white/50 text-sm">Actual - Usage</p>
                    <p
                      className={`text-xl font-bold ${
                        usageComparisonTotals.variance > 0
                          ? "text-red-200"
                          : "text-green-200"
                      }`}
                    >
                      {money(usageComparisonTotals.variance)}
                    </p>
                  </div>
                </div>
              </div>

              {usageComparisonRows.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-4 text-white/55">
                  No usage or expense data for this selection.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-left text-white/50 text-sm">
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Estimated Usage Cost</th>
                        <th className="px-4 py-2">Actual Expenses</th>
                        <th className="px-4 py-2">Difference</th>
                        <th className="px-4 py-2">Meaning</th>
                      </tr>
                    </thead>

                    <tbody>
                      {usageComparisonRows.map((row) => (
                        <tr key={row.key}>
                          <td className="rounded-l-2xl bg-white/5 px-4 py-4 font-bold">
                            {row.label}
                          </td>
                          <td className="bg-white/5 px-4 py-4 text-green-200 font-bold">
                            {money(row.estimatedUsageCost)}
                          </td>
                          <td className="bg-white/5 px-4 py-4 text-pink-100 font-bold">
                            {money(row.actualExpense)}
                          </td>
                          <td
                            className={`bg-white/5 px-4 py-4 font-bold ${
                              row.variance > 0 ? "text-red-200" : "text-green-200"
                            }`}
                          >
                            {money(row.variance)}
                          </td>
                          <td className="rounded-r-2xl bg-white/5 px-4 py-4 text-white/60">
                            {row.variance > 0
                              ? "You bought/spent more than this period's POS usage estimate."
                              : row.variance < 0
                              ? "POS usage estimate is higher than expenses entered for this period."
                              : "Actual expenses match estimated POS usage."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-yellow-100 text-sm">
                Crave Chocolate cost is still set to Rs. 0 because its pack cost was not given yet, so Frozen Hot Chocolate is undercounted until that is updated.
              </div>
            </section>

            {focusedLegacyRevenue.length > 0 && (
              <section className="mt-5 rounded-[30px] bg-[#151922] border border-white/10 p-5">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold">Legacy Revenue Rows</h2>
                    <p className="text-white/50 mt-1">
                      Imported revenue included in this selected report.
                    </p>
                  </div>

                  <p className="text-[#d81b72] font-bold">
                    {focusedLegacyRevenue.length} rows
                  </p>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {focusedLegacyRevenue.map((row) => (
                    <div key={row.id} className="rounded-2xl bg-white/5 p-4">
                      <p className="text-white/50 text-sm">
                        {formatDateLabel(row.revenue_date)}
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {money(Number(row.revenue || 0))}
                      </p>

                      <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                        <div className="rounded-xl bg-black/15 p-2">
                          <p className="text-white/45">Cash</p>
                          <p className="font-bold">
                            {money(Number(row.cash || 0))}
                          </p>
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
              </section>
            )}

            <section className="grid xl:grid-cols-2 gap-5 mt-5">
              <ReportTable
                title="Waffles Sold"
                subtitle="Only live POS orders have item-level data"
                rows={waffleSummary}
              />

              <ReportTable
                title="Coffee Cups Sold"
                subtitle="Only live POS orders have item-level data"
                rows={coffeeSummary}
              />

              <ReportTable
                title="Ice Cream Shakes Sold"
                subtitle="Only live POS orders have item-level data"
                rows={shakeSummary}
              />

              <ReportTable
                title="Ice Cream Items Sold"
                subtitle="1 scoop, 2 scoop and 3 scoop POS orders"
                rows={iceCreamItemSummary}
              />

              <ReportTable
                title="Flavor-wise Scoops"
                subtitle="Each selected POS flavor counts as one scoop"
                rows={flavorScoopSummary}
                valueLabel="Scoops"
              />

              <ReportTable
                title="Sauce Usage"
                subtitle="Free waffle sauce selections from POS orders"
                rows={sauceSummary}
              />

              <ReportTable
                title="Topping Usage"
                subtitle="Free topping selections from POS orders"
                rows={toppingSummary}
              />

              <ReportTable
                title="Paid Add-ons"
                subtitle="Add-on quantity and value from POS orders"
                rows={addonSummary}
              />
            </section>

            <section className="mt-5">
              <div className="rounded-[30px] bg-[#151922] border border-white/10 p-5">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {viewMode === "daily"
                        ? "All POS Orders for Selected Day"
                        : "All POS Orders for Selected Month"}
                    </h2>
                    <p className="text-white/50 mt-1">
                      Includes cancelled POS orders for audit. Legacy revenue is
                      shown separately above because it has no item-level order
                      details.
                    </p>
                  </div>

                  <p className="text-[#d81b72] font-bold">
                    {focusedOrders.length} orders
                  </p>
                </div>

                {focusedOrders.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-4 text-white/60">
                    No POS orders found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {focusedOrders.map((order) => {
                      const items = itemsByOrderId.get(order.id) || [];

                      return (
                        <div
                          key={order.id}
                          className={`rounded-[26px] border p-5 ${
                            order.status === "cancelled"
                              ? "bg-red-500/10 border-red-500/25"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-white/55 text-sm">
                                Order #{order.order_no}
                              </p>
                              <h3 className="text-2xl font-bold mt-1">
                                {money(Number(order.total))}
                              </h3>
                              {Number(order.discount || 0) > 0 && (
                                <p className="text-[#d81b72] font-bold mt-1">
                                  Discount: -{" "}
                                  {money(Number(order.discount || 0))}
                                </p>
                              )}

                              {order.is_free && (
                                <p className="text-green-200 font-bold mt-1">
                                  Free Order: {freeReasonLabel(order.free_reason)}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold capitalize">
                                {order.payment_method}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${
                                  order.status === "cancelled"
                                    ? "bg-red-500/20 text-red-200"
                                    : order.status === "completed"
                                    ? "bg-green-500/20 text-green-200"
                                    : "bg-[#d81b72]/20 text-pink-200"
                                }`}
                              >
                                {order.status}
                              </span>
                              <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
                                {new Date(order.created_at).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {items.map((item) => {
                              const options = optionsByItemId.get(item.id) || [];
                              const flavors = options.filter(
                                (option) =>
                                  option.option_group === "Ice Cream Flavor"
                              );
                              const sauces = options.filter(
                                (option) => option.option_group === "Free Sauce"
                              );
                              const toppings = options.filter(
                                (option) =>
                                  option.option_group === "Free Topping"
                              );
                              const addons = options.filter(
                                (option) => option.option_group === "Add-on"
                              );

                              return (
                                <div
                                  key={item.id}
                                  className="rounded-2xl bg-black/15 p-4"
                                >
                                  <p className="font-bold">
                                    {getItemDisplayName(item)}
                                  </p>
                                  <p className="text-white/55 text-sm mt-1">
                                    Qty {item.quantity} |{" "}
                                    {money(Number(item.line_total))}
                                  </p>

                                  {flavors.length > 0 && (
                                    <p className="text-white/75 text-sm mt-2">
                                      <span className="font-bold">
                                        Flavors:
                                      </span>{" "}
                                      {flavors
                                        .map((option) => option.option_name)
                                        .join(" + ")}
                                    </p>
                                  )}

                                  {sauces.length > 0 && (
                                    <p className="text-white/75 text-sm mt-2">
                                      <span className="font-bold">Sauce:</span>{" "}
                                      {sauces
                                        .map((option) => option.option_name)
                                        .join(", ")}
                                    </p>
                                  )}

                                  {toppings.length > 0 && (
                                    <p className="text-white/75 text-sm mt-2">
                                      <span className="font-bold">
                                        Topping:
                                      </span>{" "}
                                      {toppings
                                        .map((option) => option.option_name)
                                        .join(", ")}
                                    </p>
                                  )}

                                  {addons.length > 0 && (
                                    <p className="text-white/75 text-sm mt-2">
                                      <span className="font-bold">
                                        Add-ons:
                                      </span>{" "}
                                      {addons
                                        .map((option) => option.option_name)
                                        .join(", ")}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-5">
            <div className="rounded-[30px] bg-[#151922] border border-white/10 p-8 text-center text-white/60">
              Select a day or month above to open a detailed report.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
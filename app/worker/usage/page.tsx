"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  order_no: number;
  status: string;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
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

type Product = {
  id: string;
  category: string;
  name: string;
  variant: string | null;
  size: string | null;
  price: number;
};

type UsageRow = {
  section: string;
  item: string;
  used: number;
  unit: string;
  packSize?: number;
  packLabel?: string;
  packCost?: number;
  packsUsed?: number;
  estimatedCost?: number;
  note?: string;
  calculations: string[];
};

type MonthRow = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

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

// Frozen hot chocolate assumptions.
// User gave cream cost but not pack size; using 200g pack as editable assumption.
// User gave Crave chocolate quantity but not pack cost, so cost is left unset at 0 until updated.
const FROZEN_HOT_CHOCOLATE_CRAVE_CHOCOLATE_G = 55;
const FROZEN_HOT_CHOCOLATE_MILK_ML = 200;
const FROZEN_HOT_CHOCOLATE_CREAM_G = 50;
const CREAM_PACK_G_ESTIMATE = 200;
const CREAM_PACK_COST = 250;
const CRAVE_CHOCOLATE_PACK_G_ESTIMATE = 1000;
const CRAVE_CHOCOLATE_PACK_COST = 0;

// Standalone extras assumptions. Edit if your portions differ.
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
  eggs: 2,
  flourG: 240,
  milkMl: 420,
  oilMl: 120,
  saltG: 1.5,
  sugarG: 25,
  bakingPowderG: 16,
  vanillaEssenceMl: 10,
};

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

function money(value: number) {
  const rounded = Math.round(value || 0);
  return `Rs. ${rounded.toLocaleString()}`;
}

function formatMonthLabel(key: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthKey(value: string) {
  return new Date(value).toISOString().slice(0, 7);
}

function prettyDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getWaffleSizeLabel(size: string | null | undefined) {
  if (size === "Small") return "Quarter";
  if (size === "Medium") return "Half";
  if (size === "Large") return "Full";
  return size || "Unknown";
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

function getSaucePackInfo(name: string) {
  if (name === "Nutella Sauce") {
    return {
      packSize: NUTELLA_MIX_BOTTLE_ML_ESTIMATE,
      packLabel: "Nutella mixture bottle",
      packCost: NUTELLA_MIX_BOTTLE_COST,
    };
  }

  if (name === "Chocolate Sauce") {
    return {
      packSize: HERSHEY_CHOCOLATE_BOTTLE_ML_ESTIMATE,
      packLabel: "Hershey chocolate bottle est.",
      packCost: HERSHEY_BOTTLE_COST,
    };
  }

  if (name === "Strawberry Sauce") {
    return {
      packSize: HERSHEY_STRAWBERRY_BOTTLE_ML_ESTIMATE,
      packLabel: "Hershey strawberry bottle est.",
      packCost: HERSHEY_BOTTLE_COST,
    };
  }

  if (name === "Maple Sauce") {
    return {
      packSize: MAPLE_BOTTLE_ML,
      packLabel: "maple bottle",
      packCost: MAPLE_BOTTLE_COST,
    };
  }

  return {};
}

function getShakeFlavor(productName: string) {
  const n = productName.toLowerCase();

  if (n.includes("strawberry")) return "Strawberry";
  if (n.includes("vanilla")) return "Vanilla";
  if (n.includes("chocolate")) return "Chocolate";
  if (n.includes("cookies")) return "Cookies & Cream";
  if (n.includes("mango")) return "Mango";

  return "Unknown Flavor";
}

function getPackDisplay(row: UsageRow) {
  if (!row.packSize || !row.packLabel) return "-";
  return `${row.packSize.toLocaleString()} ${row.unit} / ${row.packLabel}`;
}

function getPackCostDisplay(row: UsageRow) {
  if (!row.packCost) return "-";
  return money(row.packCost);
}

function getEstimatedCost(row: UsageRow) {
  if (!row.packSize || !row.packCost) return 0;
  return (row.used / row.packSize) * row.packCost;
}

function addUsage(map: Map<string, UsageRow>, row: UsageRow) {
  const key = `${row.section}__${row.item}__${row.unit}`;

  const existing = map.get(key);

  if (existing) {
    existing.used += row.used;
    existing.calculations.push(...row.calculations);

    if (!existing.note && row.note) {
      existing.note = row.note;
    }

    if (!existing.packCost && row.packCost) {
      existing.packCost = row.packCost;
    }

    return;
  }

  map.set(key, {
    ...row,
    packsUsed: row.packSize ? row.used / row.packSize : undefined,
    estimatedCost:
      row.packSize && row.packCost ? (row.used / row.packSize) * row.packCost : 0,
  });
}

function finalizeRows(map: Map<string, UsageRow>) {
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      used: round(row.used, 2),
      packsUsed: row.packSize ? round(row.used / row.packSize, 2) : undefined,
      estimatedCost:
        row.packSize && row.packCost
          ? round((row.used / row.packSize) * row.packCost, 2)
          : 0,
    }))
    .sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.item.localeCompare(b.item);
    });
}

export default function UsagePage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemOptions, setItemOptions] = useState<OrderItemOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

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

      if (profile?.role !== "admin" && profile?.role !== "worker") {
        router.push("/pos");
        return;
      }

      const { data: productData } = await supabase
        .from("products")
        .select("id, category, name, variant, size, price");

      setProducts((productData || []) as Product[]);

      const { data: orderData } = await supabase
        .from("orders")
        .select("id, order_no, status, created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      const safeOrders = (orderData || []) as Order[];
      setOrders(safeOrders);

      const orderIds = safeOrders.map((order) => order.id);

      if (orderIds.length === 0) {
        setOrderItems([]);
        setItemOptions([]);
        return;
      }

      const { data: itemData } = await supabase
        .from("order_items")
        .select("id, order_id, product_id, product_name, category, quantity, line_total")
        .in("order_id", orderIds);

      const safeItems = (itemData || []) as OrderItem[];
      setOrderItems(safeItems);

      const itemIds = safeItems.map((item) => item.id);

      if (itemIds.length === 0) {
        setItemOptions([]);
        return;
      }

      const { data: optionData } = await supabase
        .from("order_item_options")
        .select("id, order_item_id, option_name, option_group, price")
        .in("order_item_id", itemIds);

      setItemOptions((optionData || []) as OrderItemOption[]);
    } finally {
      setLoading(false);
    }
  }

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();

    products.forEach((product) => {
      map.set(product.id, product);
    });

    return map;
  }, [products]);

  const optionsByItemId = useMemo(() => {
    const map = new Map<string, OrderItemOption[]>();

    itemOptions.forEach((option) => {
      const existing = map.get(option.order_item_id) || [];
      existing.push(option);
      map.set(option.order_item_id, existing);
    });

    return map;
  }, [itemOptions]);

  const monthOptions = useMemo<MonthRow[]>(() => {
    const map = new Map<string, { dates: string[] }>();

    orders.forEach((order) => {
      const m = monthKey(order.created_at);
      const d = dateKey(order.created_at);

      const existing = map.get(m) || { dates: [] };
      existing.dates.push(d);
      map.set(m, existing);
    });

    return Array.from(map.entries())
      .map(([key, data]) => {
        const sortedDates = data.dates.sort();

        return {
          key,
          label: formatMonthLabel(key),
          startDate: sortedDates[0],
          endDate: sortedDates[sortedDates.length - 1],
        };
      })
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [orders]);

  useEffect(() => {
    if (monthOptions.length === 0) return;

    const exists = monthOptions.some((month) => month.key === selectedMonth);

    if (!selectedMonth || !exists) {
      setSelectedMonth(monthOptions[0].key);
    }
  }, [monthOptions, selectedMonth]);

  const selectedMonthInfo = useMemo(() => {
    return monthOptions.find((month) => month.key === selectedMonth) || null;
  }, [monthOptions, selectedMonth]);

  const focusedOrders = useMemo(() => {
    if (!selectedMonth) return [];
    return orders.filter((order) => monthKey(order.created_at) === selectedMonth);
  }, [orders, selectedMonth]);

  const focusedOrderIds = useMemo(() => {
    return new Set(focusedOrders.map((order) => order.id));
  }, [focusedOrders]);

  const focusedItems = useMemo(() => {
    return orderItems.filter((item) => focusedOrderIds.has(item.order_id));
  }, [orderItems, focusedOrderIds]);

  const usageRows = useMemo(() => {
    const usage = new Map<string, UsageRow>();

    focusedItems.forEach((item) => {
      const product = item.product_id ? productsById.get(item.product_id) : null;
      const category = product?.category || item.category;
      const name = product?.name || item.product_name;
      const size = product?.size || null;
      const variant = product?.variant || null;
      const quantity = Number(item.quantity || 1);
      const options = optionsByItemId.get(item.id) || [];

      if (category === "Cold Brew" || name === "Cold Brew") {
        addUsage(usage, {
          section: "Cold Brew",
          item: "Cold Brew",
          used: quantity,
          unit: "bottles",
          packSize: 1,
          packLabel: "cold brew unit",
          packCost: COLD_BREW_UNIT_COST,
          calculations: [
            `${quantity} Cold Brew sold × ${money(COLD_BREW_UNIT_COST)} cost = ${money(
              quantity * COLD_BREW_UNIT_COST
            )}`,
          ],
          note: "Fixed purchase cost per Cold Brew unit.",
        });
      }

      if (category === "Extras") {
        if (name === "Oreos") {
          const used = STANDALONE_OREO_PACKETS * quantity;
          addUsage(usage, {
            section: "Standalone Extras",
            item: "Oreos",
            used,
            unit: "packets",
            packSize: 8,
            packLabel: "8-pack Oreo bundle",
            packCost: 282,
            calculations: [
              `${quantity} standalone Oreo item(s) × ${STANDALONE_OREO_PACKETS} packet = ${round(used, 2)} packets`,
              `${round(used, 2)} packets ÷ 8 packets per bundle × ${money(282)} = ${money((used / 8) * 282)}`,
            ],
            note: "Standalone extra assumption: 1 Oreo packet per sale.",
          });
        }

        if (name === "Dairy Milk") {
          const used = DAIRY_MILK_BAR_G * quantity;
          addUsage(usage, {
            section: "Standalone Extras",
            item: "Dairy Milk",
            used,
            unit: "g",
            packSize: DAIRY_MILK_BAR_G,
            packLabel: "56g bar",
            packCost: DAIRY_MILK_BAR_COST,
            calculations: [
              `${quantity} standalone Dairy Milk item(s) × ${DAIRY_MILK_BAR_G}g = ${round(used, 2)}g`,
              `${round(used, 2)}g ÷ ${DAIRY_MILK_BAR_G}g per bar × ${money(DAIRY_MILK_BAR_COST)} = ${money((used / DAIRY_MILK_BAR_G) * DAIRY_MILK_BAR_COST)}`,
            ],
            note: "Standalone Dairy Milk uses a full bar.",
          });
        }

        if (["Nutella", "Chocolate", "Strawberry", "Maple"].includes(name)) {
          const sauceName = sauceUsageName(name);
          const pack = getSaucePackInfo(sauceName);
          const used = STANDALONE_SAUCE_EXTRA_ML * quantity;
          addUsage(usage, {
            section: "Standalone Extras",
            item: sauceName,
            used,
            unit: "ml",
            packSize: pack.packSize,
            packLabel: pack.packLabel,
            packCost: pack.packCost,
            calculations: [
              `${quantity} standalone ${sauceName} item(s) × ${STANDALONE_SAUCE_EXTRA_ML}ml = ${round(used, 2)}ml`,
              pack.packSize
                ? `${round(used, 2)}ml ÷ ${pack.packSize}ml per ${pack.packLabel} = ${round(used / pack.packSize, 2)} bottles`
                : "No bottle size set.",
            ],
            note: "Standalone sauce extra assumption: 30ml per sale.",
          });
        }

        if (name === "Chocolate Chips") {
          const used = STANDALONE_CHOCOLATE_CHIPS_G * quantity;
          addUsage(usage, {
            section: "Standalone Extras",
            item: "Chocolate Chips",
            used,
            unit: "g",
            packSize: CHOCOLATE_CHIPS_PACK_G,
            packLabel: "100g pack",
            packCost: CHOCOLATE_CHIPS_PACK_COST,
            calculations: [
              `${quantity} standalone chocolate chip item(s) × ${STANDALONE_CHOCOLATE_CHIPS_G}g = ${round(used, 2)}g`,
              `${round(used, 2)}g ÷ ${CHOCOLATE_CHIPS_PACK_G}g per pack × ${money(CHOCOLATE_CHIPS_PACK_COST)} = ${money((used / CHOCOLATE_CHIPS_PACK_G) * CHOCOLATE_CHIPS_PACK_COST)}`,
            ],
            note: "Standalone chocolate chips assumption: 12g per sale.",
          });
        }

        if (name === "Marshmellow") {
          const used = STANDALONE_MARSHMALLOW_PACKETS * quantity;
          addUsage(usage, {
            section: "Standalone Extras",
            item: "Marshmallows",
            used,
            unit: "packets",
            packSize: MARSHMALLOW_PACKETS_PER_BOX,
            packLabel: "18-pack box",
            packCost: MARSHMALLOW_BOX_COST,
            calculations: [
              `${quantity} standalone marshmellow item(s) × ${STANDALONE_MARSHMALLOW_PACKETS} packet = ${round(used, 2)} packets`,
              `${round(used, 2)} packets ÷ ${MARSHMALLOW_PACKETS_PER_BOX} packets per box × ${money(MARSHMALLOW_BOX_COST)} = ${money((used / MARSHMALLOW_PACKETS_PER_BOX) * MARSHMALLOW_BOX_COST)}`,
            ],
            note: "Standalone marshmellow assumption: 1 packet per sale.",
          });
        }

        if (name === "Ice") {
          const used = STANDALONE_ICE_G * quantity;
          addUsage(usage, {
            section: "Standalone Extras",
            item: "Ice",
            used,
            unit: "g",
            packSize: ICE_BAG_G,
            packLabel: "1.5kg ice bag",
            packCost: ICE_BAG_COST,
            calculations: [
              `${quantity} standalone ice item(s) × ${STANDALONE_ICE_G}g = ${round(used, 2)}g`,
              `${round(used, 2)}g ÷ ${ICE_BAG_G}g per bag × ${money(ICE_BAG_COST)} = ${money((used / ICE_BAG_G) * ICE_BAG_COST)}`,
            ],
            note: "Standalone ice assumption uses same quantity as cold coffee ice.",
          });
        }

        if (["Small Plate", "Big Plate", "Spoon", "Knife", "Fork", "Regular Cup", "Large Cup", "Coffee Cup", "Straw"].includes(name)) {
          addUsage(usage, {
            section: "Packaging Extras",
            item: name,
            used: quantity,
            unit: "pcs",
            calculations: [`${quantity} ${name} standalone item(s) sold = ${quantity} pcs`],
            note: "Cost not set yet for packaging/cutlery extras.",
          });
        }
      }

      if (category === "Waffles") {
        const factor = WAFFLE_SIZE_FACTOR[size || ""] || 1;
        const sizeLabel = getWaffleSizeLabel(size);
        const sauceMl = SAUCE_ML_BY_WAFFLE_SIZE[size || ""] || 30;
        const oreoBiscuits = OREO_BISCUITS_BY_WAFFLE_SIZE[size || ""] || 3;
        const dairyMilkG = DAIRY_MILK_G_BY_WAFFLE_SIZE[size || ""] || 22;
        const marshmallowPackets =
          MARSHMALLOW_PACKETS_BY_WAFFLE_SIZE[size || ""] || 1;
        const chocolateChipsG =
          CHOCOLATE_CHIPS_G_BY_WAFFLE_SIZE[size || ""] || 12;

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Eggs",
          used: FULL_WAFFLE_RECIPE.eggs * factor * quantity,
          unit: "eggs",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.eggs} eggs × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.eggs * factor * quantity,
              2
            )} eggs`,
          ],
        });

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Flour",
          used: FULL_WAFFLE_RECIPE.flourG * factor * quantity,
          unit: "g",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.flourG}g flour × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.flourG * factor * quantity,
              2
            )}g`,
          ],
        });

        const waffleMilkUsed = FULL_WAFFLE_RECIPE.milkMl * factor * quantity;

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Milk",
          used: waffleMilkUsed,
          unit: "ml",
          packSize: MILK_BOTTLE_ML,
          packLabel: "1L milk bottle",
          packCost: MILK_BOTTLE_COST,
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.milkMl}ml milk × ${factor} size factor = ${round(
              waffleMilkUsed,
              2
            )}ml`,
            `${round(waffleMilkUsed, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle = ${round(
              waffleMilkUsed / MILK_BOTTLE_ML,
              2
            )} bottles`,
            `${round(waffleMilkUsed / MILK_BOTTLE_ML, 2)} bottles × ${money(
              MILK_BOTTLE_COST
            )} = ${money((waffleMilkUsed / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
          ],
        });

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Oil",
          used: FULL_WAFFLE_RECIPE.oilMl * factor * quantity,
          unit: "ml",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.oilMl}ml oil × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.oilMl * factor * quantity,
              2
            )}ml`,
          ],
        });

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Salt",
          used: FULL_WAFFLE_RECIPE.saltG * factor * quantity,
          unit: "g",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.saltG}g salt × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.saltG * factor * quantity,
              2
            )}g`,
          ],
        });

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Sugar",
          used: FULL_WAFFLE_RECIPE.sugarG * factor * quantity,
          unit: "g",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.sugarG}g sugar × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.sugarG * factor * quantity,
              2
            )}g`,
          ],
        });

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Baking Powder",
          used: FULL_WAFFLE_RECIPE.bakingPowderG * factor * quantity,
          unit: "g",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.bakingPowderG}g baking powder × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.bakingPowderG * factor * quantity,
              2
            )}g`,
          ],
        });

        addUsage(usage, {
          section: "Waffle Batter",
          item: "Vanilla Essence",
          used: FULL_WAFFLE_RECIPE.vanillaEssenceMl * factor * quantity,
          unit: "ml",
          calculations: [
            `${quantity} ${sizeLabel} waffle(s) × ${FULL_WAFFLE_RECIPE.vanillaEssenceMl}ml vanilla essence × ${factor} size factor = ${round(
              FULL_WAFFLE_RECIPE.vanillaEssenceMl * factor * quantity,
              2
            )}ml`,
          ],
        });

        if (name === "Kit Kat Waffle") {
          const kitkatFingers = KITKAT_FINGERS_BY_WAFFLE_SIZE[size || ""] || 2;
          const kitkatUsed = kitkatFingers * quantity;

          addUsage(usage, {
            section: "Toppings",
            item: "KitKat",
            used: kitkatUsed,
            unit: "fingers",
            packSize: KITKAT_FINGERS_PER_PACK,
            packLabel: "2-finger KitKat",
            packCost: KITKAT_PACK_COST,
            calculations: [
              `${quantity} ${sizeLabel} KitKat waffle(s) × ${kitkatFingers} KitKat finger(s) = ${round(
                kitkatUsed,
                2
              )} fingers`,
              `${round(kitkatUsed, 2)} fingers ÷ ${KITKAT_FINGERS_PER_PACK} fingers per pack = ${round(
                kitkatUsed / KITKAT_FINGERS_PER_PACK,
                2
              )} packs`,
              `${round(kitkatUsed / KITKAT_FINGERS_PER_PACK, 2)} packs × ${money(
                KITKAT_PACK_COST
              )} = ${money((kitkatUsed / KITKAT_FINGERS_PER_PACK) * KITKAT_PACK_COST)}`,
            ],
            note: "Quarter = 1 finger, Half = 2 fingers, Full = 3 fingers.",
          });

          const pack = getSaucePackInfo("Nutella Sauce");
          const nutellaUsed = sauceMl * quantity;

          addUsage(usage, {
            section: "Sauces",
            item: "Nutella Sauce",
            used: nutellaUsed,
            unit: "ml",
            packSize: pack.packSize,
            packLabel: pack.packLabel,
            packCost: pack.packCost,
            calculations: [
              `${quantity} ${sizeLabel} KitKat waffle(s) × ${sauceMl}ml Nutella sauce = ${round(
                nutellaUsed,
                2
              )}ml`,
              `${round(nutellaUsed, 2)}ml ÷ ${
                pack.packSize
              }ml per Nutella mixture bottle = ${round(
                nutellaUsed / Number(pack.packSize || 1),
                2
              )} bottles`,
              `${round(nutellaUsed / Number(pack.packSize || 1), 2)} bottles × ${money(
                Number(pack.packCost || 0)
              )} = ${money(
                (nutellaUsed / Number(pack.packSize || 1)) *
                  Number(pack.packCost || 0)
              )}`,
            ],
            note: "KitKat waffle uses Nutella sauce with the same quarter/half/full sauce quantity.",
          });
        }

        options.forEach((option) => {
          const optionName = option.option_name;

          if (isSauceOption(optionName)) {
            const sauceName = sauceUsageName(optionName);
            const pack = getSaucePackInfo(sauceName);
            const used = sauceMl * quantity;

            addUsage(usage, {
              section: "Sauces",
              item: sauceName,
              used,
              unit: "ml",
              packSize: pack.packSize,
              packLabel: pack.packLabel,
              packCost: pack.packCost,
              calculations: [
                `${quantity} ${sizeLabel} waffle(s) × ${sauceMl}ml ${sauceName} = ${round(
                  used,
                  2
                )}ml`,
                pack.packSize
                  ? `${round(used, 2)}ml ÷ ${pack.packSize}ml per ${
                      pack.packLabel
                    } = ${round(used / pack.packSize, 2)} bottles`
                  : "No bottle size set for this sauce.",
                pack.packSize && pack.packCost
                  ? `${round(used / pack.packSize, 2)} bottles × ${money(
                      pack.packCost
                    )} = ${money((used / pack.packSize) * pack.packCost)}`
                  : "No cost set for this sauce.",
              ],
              note: `${sizeLabel} waffle sauce amount`,
            });

            return;
          }

          if (optionName === "Oreos") {
            const used = oreoBiscuits * quantity;

            addUsage(usage, {
              section: "Toppings",
              item: "Oreos",
              used,
              unit: "biscuits",
              packSize: OREO_BISCUITS_PER_PACKET,
              packLabel: "Oreo packet",
              packCost: OREO_PACKET_COST,
              calculations: [
                `${quantity} ${sizeLabel} waffle(s) × ${oreoBiscuits} Oreo biscuit(s) = ${round(
                  used,
                  2
                )} biscuits`,
                `${round(used, 2)} biscuits ÷ ${OREO_BISCUITS_PER_PACKET} biscuits per packet = ${round(
                  used / OREO_BISCUITS_PER_PACKET,
                  2
                )} packets`,
                `${round(used / OREO_BISCUITS_PER_PACKET, 2)} packets × ${money(
                  OREO_PACKET_COST
                )} = ${money((used / OREO_BISCUITS_PER_PACKET) * OREO_PACKET_COST)}`,
              ],
            });

            return;
          }

          if (optionName === "Dairy Milk") {
            const used = dairyMilkG * quantity;

            addUsage(usage, {
              section: "Toppings",
              item: "Dairy Milk",
              used,
              unit: "g",
              packSize: DAIRY_MILK_BAR_G,
              packLabel: "56g bar",
              packCost: DAIRY_MILK_BAR_COST,
              calculations: [
                `${quantity} ${sizeLabel} waffle(s) × ${dairyMilkG}g Dairy Milk = ${round(
                  used,
                  2
                )}g`,
                `${round(used, 2)}g ÷ ${DAIRY_MILK_BAR_G}g per bar = ${round(
                  used / DAIRY_MILK_BAR_G,
                  2
                )} bars`,
                `${round(used / DAIRY_MILK_BAR_G, 2)} bars × ${money(
                  DAIRY_MILK_BAR_COST
                )} = ${money((used / DAIRY_MILK_BAR_G) * DAIRY_MILK_BAR_COST)}`,
              ],
            });

            return;
          }

          if (optionName === "Marshmallows") {
            const used = marshmallowPackets * quantity;

            addUsage(usage, {
              section: "Toppings",
              item: "Marshmallows",
              used,
              unit: "packets",
              packSize: MARSHMALLOW_PACKETS_PER_BOX,
              packLabel: "18-pack box",
              packCost: MARSHMALLOW_BOX_COST,
              calculations: [
                `${quantity} ${sizeLabel} waffle(s) × ${marshmallowPackets} marshmallow packet(s) = ${round(
                  used,
                  2
                )} packets`,
                `${round(used, 2)} packets ÷ ${MARSHMALLOW_PACKETS_PER_BOX} packets per box = ${round(
                  used / MARSHMALLOW_PACKETS_PER_BOX,
                  2
                )} boxes`,
                `${round(used / MARSHMALLOW_PACKETS_PER_BOX, 2)} boxes × ${money(
                  MARSHMALLOW_BOX_COST
                )} = ${money(
                  (used / MARSHMALLOW_PACKETS_PER_BOX) * MARSHMALLOW_BOX_COST
                )}`,
              ],
            });

            return;
          }

          if (optionName === "Chocolate Chips") {
            const used = chocolateChipsG * quantity;

            addUsage(usage, {
              section: "Toppings",
              item: "Chocolate Chips",
              used,
              unit: "g",
              packSize: CHOCOLATE_CHIPS_PACK_G,
              packLabel: "100g pack",
              packCost: CHOCOLATE_CHIPS_PACK_COST,
              calculations: [
                `${quantity} ${sizeLabel} waffle(s) × ${chocolateChipsG}g chocolate chips = ${round(
                  used,
                  2
                )}g`,
                `${round(used, 2)}g ÷ ${CHOCOLATE_CHIPS_PACK_G}g per pack = ${round(
                  used / CHOCOLATE_CHIPS_PACK_G,
                  2
                )} packs`,
                `${round(used / CHOCOLATE_CHIPS_PACK_G, 2)} packs × ${money(
                  CHOCOLATE_CHIPS_PACK_COST
                )} = ${money(
                  (used / CHOCOLATE_CHIPS_PACK_G) * CHOCOLATE_CHIPS_PACK_COST
                )}`,
              ],
            });

            return;
          }

          if (optionName === "Ice Cream Scoop") {
            const used = WAFFLE_ICE_CREAM_ADDON_ML * quantity;

            addUsage(usage, {
              section: "Ice Cream Add-ons",
              item: "Ice Cream Scoop Add-on",
              used,
              unit: "ml",
              packSize: ML_PER_ICE_CREAM_BOX,
              packLabel: "1.5L box",
              packCost: ICE_CREAM_BOX_COST,
              calculations: [
                `${quantity} waffle ice cream scoop add-on(s) × ${WAFFLE_ICE_CREAM_ADDON_ML}ml = ${round(
                  used,
                  2
                )}ml`,
                `${round(used, 2)}ml ÷ ${ML_PER_ICE_CREAM_BOX}ml per box = ${round(
                  used / ML_PER_ICE_CREAM_BOX,
                  2
                )} boxes`,
                `${round(used / ML_PER_ICE_CREAM_BOX, 2)} boxes × ${money(
                  ICE_CREAM_BOX_COST
                )} = ${money((used / ML_PER_ICE_CREAM_BOX) * ICE_CREAM_BOX_COST)}`,
              ],
              note: "Flavor is not tracked for waffle ice cream scoop add-ons.",
            });
          }
        });
      }

      if (category === "Ice Cream Shakes") {
        const flavor = getShakeFlavor(name);
        const iceCreamMl = size === "Large" ? 400 : 300;
        const milkMl = size === "Large" ? 70 : 50;

        addUsage(usage, {
          section: "Ice Cream",
          item: flavor,
          used: iceCreamMl * quantity,
          unit: "ml",
          packSize: ML_PER_ICE_CREAM_BOX,
          packLabel: "1.5L box",
          packCost: ICE_CREAM_BOX_COST,
          calculations: [
            `${quantity} ${size === "Large" ? "large" : "regular"} ${flavor} shake(s) × ${iceCreamMl}ml ice cream = ${round(
              iceCreamMl * quantity,
              2
            )}ml`,
            `${round(iceCreamMl * quantity, 2)}ml ÷ ${ML_PER_ICE_CREAM_BOX}ml per box = ${round(
              (iceCreamMl * quantity) / ML_PER_ICE_CREAM_BOX,
              2
            )} boxes`,
            `${round((iceCreamMl * quantity) / ML_PER_ICE_CREAM_BOX, 2)} boxes × ${money(
              ICE_CREAM_BOX_COST
            )} = ${money(
              ((iceCreamMl * quantity) / ML_PER_ICE_CREAM_BOX) *
                ICE_CREAM_BOX_COST
            )}`,
          ],
          note: `${size === "Large" ? "Large" : "Regular"} shake`,
        });

        addUsage(usage, {
          section: "Milk",
          item: "Milk",
          used: milkMl * quantity,
          unit: "ml",
          packSize: MILK_BOTTLE_ML,
          packLabel: "1L milk bottle",
          packCost: MILK_BOTTLE_COST,
          calculations: [
            `${quantity} ${size === "Large" ? "large" : "regular"} shake(s) × ${milkMl}ml milk = ${round(
              milkMl * quantity,
              2
            )}ml`,
            `${round(milkMl * quantity, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle = ${round(
              (milkMl * quantity) / MILK_BOTTLE_ML,
              2
            )} bottles`,
            `${round((milkMl * quantity) / MILK_BOTTLE_ML, 2)} bottles × ${money(
              MILK_BOTTLE_COST
            )} = ${money(((milkMl * quantity) / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
          ],
        });
      }

      if (category === "Ice Cream") {
        options
          .filter((option) => option.option_group === "Ice Cream Flavor")
          .forEach((option) => {
            const used = 100 * quantity;

            addUsage(usage, {
              section: "Ice Cream",
              item: option.option_name,
              used,
              unit: "ml",
              packSize: ML_PER_ICE_CREAM_BOX,
              packLabel: "1.5L box",
              packCost: ICE_CREAM_BOX_COST,
              calculations: [
                `${quantity} scoop selection(s) of ${option.option_name} × 100ml per scoop = ${round(
                  used,
                  2
                )}ml`,
                `${round(used, 2)}ml ÷ ${ML_PER_ICE_CREAM_BOX}ml per box = ${round(
                  used / ML_PER_ICE_CREAM_BOX,
                  2
                )} boxes`,
                `${round(used / ML_PER_ICE_CREAM_BOX, 2)} boxes × ${money(
                  ICE_CREAM_BOX_COST
                )} = ${money((used / ML_PER_ICE_CREAM_BOX) * ICE_CREAM_BOX_COST)}`,
              ],
              note: "Each scoop = 100ml",
            });
          });
      }

      if (category === "Drinks") {
        const lowerName = name.toLowerCase();

        const isHotChocolate =
          lowerName === "hot chocolate" || lowerName === "nutella hot chocolate";
        const isFrozenHotChocolate = lowerName === "frozen hot chocolate";

        if (isFrozenHotChocolate) {
          const craveUsed = FROZEN_HOT_CHOCOLATE_CRAVE_CHOCOLATE_G * quantity;
          const milkUsed = FROZEN_HOT_CHOCOLATE_MILK_ML * quantity;
          const creamUsed = FROZEN_HOT_CHOCOLATE_CREAM_G * quantity;
          const iceUsed = COLD_COFFEE_ICE_G * quantity;

          addUsage(usage, {
            section: "Frozen Hot Chocolate",
            item: "Crave Chocolate",
            used: craveUsed,
            unit: "g",
            packSize: CRAVE_CHOCOLATE_PACK_G_ESTIMATE,
            packLabel: "Crave chocolate pack estimate",
            packCost: CRAVE_CHOCOLATE_PACK_COST || undefined,
            calculations: [
              `${quantity} frozen hot chocolate(s) × ${FROZEN_HOT_CHOCOLATE_CRAVE_CHOCOLATE_G}g Crave chocolate = ${round(craveUsed, 2)}g`,
              CRAVE_CHOCOLATE_PACK_COST > 0
                ? `${round(craveUsed, 2)}g ÷ ${CRAVE_CHOCOLATE_PACK_G_ESTIMATE}g × ${money(CRAVE_CHOCOLATE_PACK_COST)} = ${money((craveUsed / CRAVE_CHOCOLATE_PACK_G_ESTIMATE) * CRAVE_CHOCOLATE_PACK_COST)}`
                : "Crave chocolate cost missing. Add cost constants to include this in total cost.",
            ],
            note: "Cost missing until Crave chocolate pack cost is set.",
          });

          addUsage(usage, {
            section: "Frozen Hot Chocolate",
            item: "Cream",
            used: creamUsed,
            unit: "g",
            packSize: CREAM_PACK_G_ESTIMATE,
            packLabel: "cream pack estimate",
            packCost: CREAM_PACK_COST,
            calculations: [
              `${quantity} frozen hot chocolate(s) × ${FROZEN_HOT_CHOCOLATE_CREAM_G}g cream = ${round(creamUsed, 2)}g`,
              `${round(creamUsed, 2)}g ÷ ${CREAM_PACK_G_ESTIMATE}g per cream pack × ${money(CREAM_PACK_COST)} = ${money((creamUsed / CREAM_PACK_G_ESTIMATE) * CREAM_PACK_COST)}`,
            ],
            note: "Cream pack size assumed as 200g. Edit constant if different.",
          });

          addUsage(usage, {
            section: "Milk",
            item: "Milk",
            used: milkUsed,
            unit: "ml",
            packSize: MILK_BOTTLE_ML,
            packLabel: "1L milk bottle",
            packCost: MILK_BOTTLE_COST,
            calculations: [
              `${quantity} frozen hot chocolate(s) × ${FROZEN_HOT_CHOCOLATE_MILK_ML}ml milk = ${round(milkUsed, 2)}ml`,
              `${round(milkUsed, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle × ${money(MILK_BOTTLE_COST)} = ${money((milkUsed / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
            ],
            note: "Frozen hot chocolate milk.",
          });

          addUsage(usage, {
            section: "Ice",
            item: "Ice",
            used: iceUsed,
            unit: "g",
            packSize: ICE_BAG_G,
            packLabel: "1.5kg ice bag",
            packCost: ICE_BAG_COST,
            calculations: [
              `${quantity} frozen hot chocolate(s) × ${COLD_COFFEE_ICE_G}g ice = ${round(iceUsed, 2)}g`,
              `${round(iceUsed, 2)}g ÷ ${ICE_BAG_G}g per bag × ${money(ICE_BAG_COST)} = ${money((iceUsed / ICE_BAG_G) * ICE_BAG_COST)}`,
            ],
            note: "Uses same ice estimate as iced latte/cold coffee.",
          });
        }

        if (!isHotChocolate && !isFrozenHotChocolate) {
          const coffeeG = lowerName.includes("cappuccino") ? 16 : 12;
          const used = coffeeG * quantity;

          addUsage(usage, {
            section: "Coffee",
            item: "Coffee Beans",
            used,
            unit: "g",
            packSize: COFFEE_BAG_G,
            packLabel: "1kg bag",
            packCost: COFFEE_BAG_COST,
            calculations: [
              `${quantity} ${name} ${variant || ""} cup(s) × ${coffeeG}g coffee = ${round(
                used,
                2
              )}g`,
              `${round(used, 2)}g ÷ ${COFFEE_BAG_G}g per bag = ${round(
                used / COFFEE_BAG_G,
                2
              )} bags`,
              `${round(used / COFFEE_BAG_G, 2)} bags × ${money(
                COFFEE_BAG_COST
              )} = ${money((used / COFFEE_BAG_G) * COFFEE_BAG_COST)}`,
            ],
          });
        }

        if (variant === "Cold" && !isFrozenHotChocolate) {
          const milkUsed = 180 * quantity;

          addUsage(usage, {
            section: "Milk",
            item: "Milk",
            used: milkUsed,
            unit: "ml",
            packSize: MILK_BOTTLE_ML,
            packLabel: "1L milk bottle",
            packCost: MILK_BOTTLE_COST,
            calculations: [
              `${quantity} cold coffee cup(s) × 180ml milk = ${round(milkUsed, 2)}ml`,
              `${round(milkUsed, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle = ${round(
                milkUsed / MILK_BOTTLE_ML,
                2
              )} bottles`,
              `${round(milkUsed / MILK_BOTTLE_ML, 2)} bottles × ${money(
                MILK_BOTTLE_COST
              )} = ${money((milkUsed / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
            ],
            note: "Cold coffee milk",
          });

          const iceUsed = COLD_COFFEE_ICE_G * quantity;

          addUsage(usage, {
            section: "Ice",
            item: "Ice",
            used: iceUsed,
            unit: "g",
            packSize: ICE_BAG_G,
            packLabel: "1.5kg ice bag",
            packCost: ICE_BAG_COST,
            calculations: [
              `${quantity} cold coffee cup(s) × ${COLD_COFFEE_ICE_G}g estimated ice = ${round(
                iceUsed,
                2
              )}g`,
              `${round(iceUsed, 2)}g ÷ ${ICE_BAG_G}g per ice bag = ${round(
                iceUsed / ICE_BAG_G,
                2
              )} bags`,
              `${round(iceUsed / ICE_BAG_G, 2)} bags × ${money(
                ICE_BAG_COST
              )} = ${money((iceUsed / ICE_BAG_G) * ICE_BAG_COST)}`,
            ],
            note: "Cold coffee only. Estimated from half-filled 12oz cup with air gaps.",
          });
        }

        if (variant === "Hot" && lowerName.includes("cappuccino")) {
          const used = 140 * quantity;

          addUsage(usage, {
            section: "Milk",
            item: "Milk",
            used,
            unit: "ml",
            packSize: MILK_BOTTLE_ML,
            packLabel: "1L milk bottle",
            packCost: MILK_BOTTLE_COST,
            calculations: [
              `${quantity} hot cappuccino cup(s) × 140ml milk = ${round(used, 2)}ml`,
              `${round(used, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle = ${round(
                used / MILK_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / MILK_BOTTLE_ML, 2)} bottles × ${money(
                MILK_BOTTLE_COST
              )} = ${money((used / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
            ],
            note: "Hot cappuccino milk",
          });
        }

        if (
          variant === "Hot" &&
          lowerName.includes("latte") &&
          !lowerName.includes("cappuccino")
        ) {
          const used = 180 * quantity;

          addUsage(usage, {
            section: "Milk",
            item: "Milk",
            used,
            unit: "ml",
            packSize: MILK_BOTTLE_ML,
            packLabel: "1L milk bottle",
            packCost: MILK_BOTTLE_COST,
            calculations: [
              `${quantity} hot latte cup(s) × 180ml milk = ${round(used, 2)}ml`,
              `${round(used, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle = ${round(
                used / MILK_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / MILK_BOTTLE_ML, 2)} bottles × ${money(
                MILK_BOTTLE_COST
              )} = ${money((used / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
            ],
            note: "Hot latte milk",
          });
        }

        if (isHotChocolate) {
          const used = 200 * quantity;

          addUsage(usage, {
            section: "Milk",
            item: "Milk",
            used,
            unit: "ml",
            packSize: MILK_BOTTLE_ML,
            packLabel: "1L milk bottle",
            packCost: MILK_BOTTLE_COST,
            calculations: [
              `${quantity} hot chocolate cup(s) × 200ml milk = ${round(used, 2)}ml`,
              `${round(used, 2)}ml ÷ ${MILK_BOTTLE_ML}ml per bottle = ${round(
                used / MILK_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / MILK_BOTTLE_ML, 2)} bottles × ${money(
                MILK_BOTTLE_COST
              )} = ${money((used / MILK_BOTTLE_ML) * MILK_BOTTLE_COST)}`,
            ],
            note: "Hot chocolate milk",
          });
        }

        if (lowerName === "nutella hot chocolate") {
          const used = 40 * quantity;

          addUsage(usage, {
            section: "Sauces",
            item: "Nutella Sauce",
            used,
            unit: "ml",
            packSize: NUTELLA_MIX_BOTTLE_ML_ESTIMATE,
            packLabel: "Nutella mixture bottle",
            packCost: NUTELLA_MIX_BOTTLE_COST,
            calculations: [
              `${quantity} Nutella hot chocolate cup(s) × 40ml Nutella sauce = ${round(
                used,
                2
              )}ml`,
              `${round(used, 2)}ml ÷ ${NUTELLA_MIX_BOTTLE_ML_ESTIMATE}ml per Nutella mixture bottle = ${round(
                used / NUTELLA_MIX_BOTTLE_ML_ESTIMATE,
                2
              )} bottles`,
              `${round(used / NUTELLA_MIX_BOTTLE_ML_ESTIMATE, 2)} bottles × ${money(
                NUTELLA_MIX_BOTTLE_COST
              )} = ${money(
                (used / NUTELLA_MIX_BOTTLE_ML_ESTIMATE) * NUTELLA_MIX_BOTTLE_COST
              )}`,
            ],
            note: "Nutella hot chocolate",
          });
        }

        if (lowerName.includes("hazelnut")) {
          const syrupMl = variant === "Cold" ? 20 : 10;
          const used = syrupMl * quantity;

          addUsage(usage, {
            section: "Syrups",
            item: "Hazelnut Syrup",
            used,
            unit: "ml",
            packSize: SYRUP_BOTTLE_ML,
            packLabel: "1L bottle",
            packCost: COFFEE_SYRUP_BOTTLE_COST,
            calculations: [
              `${quantity} ${variant || ""} hazelnut latte(s) × ${syrupMl}ml syrup = ${round(
                used,
                2
              )}ml`,
              `${round(used, 2)}ml ÷ ${SYRUP_BOTTLE_ML}ml per bottle = ${round(
                used / SYRUP_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / SYRUP_BOTTLE_ML, 2)} bottles × ${money(
                COFFEE_SYRUP_BOTTLE_COST
              )} = ${money((used / SYRUP_BOTTLE_ML) * COFFEE_SYRUP_BOTTLE_COST)}`,
            ],
          });
        }

        if (lowerName.includes("caramel")) {
          const syrupMl = variant === "Cold" ? 25 : 10;
          const used = syrupMl * quantity;

          addUsage(usage, {
            section: "Syrups",
            item: "Caramel Syrup",
            used,
            unit: "ml",
            packSize: SYRUP_BOTTLE_ML,
            packLabel: "1L bottle",
            packCost: COFFEE_SYRUP_BOTTLE_COST,
            calculations: [
              `${quantity} ${variant || ""} caramel latte(s) × ${syrupMl}ml syrup = ${round(
                used,
                2
              )}ml`,
              `${round(used, 2)}ml ÷ ${SYRUP_BOTTLE_ML}ml per bottle = ${round(
                used / SYRUP_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / SYRUP_BOTTLE_ML, 2)} bottles × ${money(
                COFFEE_SYRUP_BOTTLE_COST
              )} = ${money((used / SYRUP_BOTTLE_ML) * COFFEE_SYRUP_BOTTLE_COST)}`,
            ],
          });
        }

        if (lowerName.includes("vanilla")) {
          const syrupMl = variant === "Cold" ? 25 : 10;
          const used = syrupMl * quantity;

          addUsage(usage, {
            section: "Syrups",
            item: "Vanilla Syrup",
            used,
            unit: "ml",
            packSize: SYRUP_BOTTLE_ML,
            packLabel: "1L bottle",
            packCost: COFFEE_SYRUP_BOTTLE_COST,
            calculations: [
              `${quantity} ${variant || ""} vanilla latte(s) × ${syrupMl}ml syrup = ${round(
                used,
                2
              )}ml`,
              `${round(used, 2)}ml ÷ ${SYRUP_BOTTLE_ML}ml per bottle = ${round(
                used / SYRUP_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / SYRUP_BOTTLE_ML, 2)} bottles × ${money(
                COFFEE_SYRUP_BOTTLE_COST
              )} = ${money((used / SYRUP_BOTTLE_ML) * COFFEE_SYRUP_BOTTLE_COST)}`,
            ],
          });
        }

        if (lowerName.includes("mocha")) {
          const syrupMl = variant === "Cold" ? 30 : 10;
          const used = syrupMl * quantity;

          addUsage(usage, {
            section: "Syrups",
            item: "Chocolate Syrup",
            used,
            unit: "ml",
            packSize: SYRUP_BOTTLE_ML,
            packLabel: "1L bottle",
            packCost: COFFEE_SYRUP_BOTTLE_COST,
            calculations: [
              `${quantity} ${variant || ""} mocha latte(s) × ${syrupMl}ml chocolate syrup = ${round(
                used,
                2
              )}ml`,
              `${round(used, 2)}ml ÷ ${SYRUP_BOTTLE_ML}ml per bottle = ${round(
                used / SYRUP_BOTTLE_ML,
                2
              )} bottles`,
              `${round(used / SYRUP_BOTTLE_ML, 2)} bottles × ${money(
                COFFEE_SYRUP_BOTTLE_COST
              )} = ${money((used / SYRUP_BOTTLE_ML) * COFFEE_SYRUP_BOTTLE_COST)}`,
            ],
          });
        }
      }
    });

    return finalizeRows(usage);
  }, [focusedItems, productsById, optionsByItemId]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, UsageRow[]>();

    usageRows.forEach((row) => {
      const existing = map.get(row.section) || [];
      existing.push(row);
      map.set(row.section, existing);
    });

    return Array.from(map.entries()).map(([section, rows]) => ({
      section,
      rows,
    }));
  }, [usageRows]);

  const summary = useMemo(() => {
    const get = (section: string, unit: string) =>
      usageRows
        .filter((row) => row.section === section && row.unit === unit)
        .reduce((sum, row) => sum + row.used, 0);

    const getPacks = (section: string) =>
      usageRows
        .filter((row) => row.section === section)
        .reduce((sum, row) => sum + Number(row.packsUsed || 0), 0);

    const getCost = (section: string) =>
      usageRows
        .filter((row) => row.section === section)
        .reduce((sum, row) => sum + Number(row.estimatedCost || 0), 0);

    const milkMl = get("Milk", "ml") + get("Waffle Batter", "ml");
    const totalEstimatedCost = usageRows.reduce(
      (sum, row) => sum + Number(row.estimatedCost || 0),
      0
    );

    return {
      orders: focusedOrders.length,
      items: focusedItems.length,
      iceCreamMl: get("Ice Cream", "ml"),
      iceCreamBoxes: getPacks("Ice Cream"),
      iceCreamAddonMl: get("Ice Cream Add-ons", "ml"),
      iceCreamAddonBoxes: getPacks("Ice Cream Add-ons"),
      iceCreamAddonCost: getCost("Ice Cream Add-ons"),
      milkMl,
      milkBottles: milkMl / MILK_BOTTLE_ML,
      coffeeG: get("Coffee", "g"),
      coffeeBags: getPacks("Coffee"),
      saucesMl: get("Sauces", "ml"),
      syrupsMl: get("Syrups", "ml"),
      iceG: get("Ice", "g"),
      iceBags: getPacks("Ice"),
      totalEstimatedCost,
    };
  }, [usageRows, focusedOrders.length, focusedItems.length]);

  function toggleRow(key: string) {
    setOpenRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function toggleSection(section: string) {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

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
            <h2 className="mt-4 text-2xl font-bold">Loading usage</h2>
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
                  Monthly Usage & Cost Breakdown
                </h1>
                <p className="text-white/60 mt-2">
                  Uses POS sales only. Legacy revenue is ignored because it has no item details.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/pos"
                className="rounded-2xl border border-white/10 bg-[#0f1115] px-5 py-3 font-bold text-white"
              >
                Back to POS
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

        <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Select Month</h2>
              <p className="text-white/50 mt-1">
                Start date shown is the first POS order date found in that month.
              </p>
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-2xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white font-bold"
            >
              {monthOptions.map((month) => (
                <option key={month.key} value={month.key}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {selectedMonthInfo && (
            <div className="grid md:grid-cols-3 gap-4 mt-5">
              <div className="rounded-[24px] bg-white/5 border border-white/10 p-4">
                <p className="text-white/50">Month</p>
                <h3 className="text-2xl font-bold mt-2">
                  {selectedMonthInfo.label}
                </h3>
              </div>

              <div className="rounded-[24px] bg-white/5 border border-white/10 p-4">
                <p className="text-white/50">POS Start Date</p>
                <h3 className="text-2xl font-bold mt-2">
                  {prettyDate(selectedMonthInfo.startDate)}
                </h3>
              </div>

              <div className="rounded-[24px] bg-white/5 border border-white/10 p-4">
                <p className="text-white/50">POS End Date</p>
                <h3 className="text-2xl font-bold mt-2">
                  {prettyDate(selectedMonthInfo.endDate)}
                </h3>
              </div>
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-2 xl:grid-cols-6 gap-4 mt-5">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#d81b72,#a10d52)] p-5 xl:col-span-2">
            <p className="text-white/75">Estimated Usage Cost</p>
            <h3 className="text-4xl font-bold mt-3">
              {money(summary.totalEstimatedCost)}
            </h3>
            <p className="text-white/70 mt-2">
              Based on your average purchase costs.
            </p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">POS Orders Used</p>
            <h3 className="text-3xl font-bold mt-2">{summary.orders}</h3>
            <p className="text-white/45 mt-1">Cancelled excluded</p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Ice Cream</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.iceCreamBoxes, 2)} boxes
            </h3>
            <p className="text-white/45 mt-1">
              {round(summary.iceCreamMl, 0).toLocaleString()} ml
            </p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Ice Cream Add-ons</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.iceCreamAddonBoxes, 2)} boxes
            </h3>
            <p className="text-white/45 mt-1">
              {money(summary.iceCreamAddonCost)}
            </p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Milk</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.milkBottles, 2)} bottles
            </h3>
            <p className="text-white/45 mt-1">
              {round(summary.milkMl, 0).toLocaleString()} ml
            </p>
          </div>
        </section>

        <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 mt-4">
          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Ice</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.iceBags, 2)} bags
            </h3>
            <p className="text-white/45 mt-1">
              {round(summary.iceG, 0).toLocaleString()} g
            </p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Coffee Beans</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.coffeeG, 0).toLocaleString()} g
            </h3>
            <p className="text-white/45 mt-1">
              {round(summary.coffeeBags, 2)} bags
            </p>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Sauces</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.saucesMl, 0).toLocaleString()} ml
            </h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Syrups</p>
            <h3 className="text-3xl font-bold mt-2">
              {round(summary.syrupsMl, 0).toLocaleString()} ml
            </h3>
          </div>

          <div className="rounded-[28px] bg-[#151922] border border-white/10 p-5">
            <p className="text-white/60">Items Sold</p>
            <h3 className="text-3xl font-bold mt-2">{summary.items}</h3>
          </div>
        </section>

        <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold">Assumptions Used</h2>
              <p className="text-white/50 mt-1">
                Expand each product row below to see exact calculations.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Ice Cream</p>
              <p className="text-white/60 mt-1">
                1 box = 1.5L. Cost = Rs. 1,200. 1 scoop = 100ml. Regular shake = 300ml. Large shake = 400ml.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Ice Cream Add-ons</p>
              <p className="text-white/60 mt-1">
                Waffle ice cream scoop add-ons are not flavor tracked. Each add-on = 100ml. Cost uses same Rs. 1,200 per 1.5L box.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Milk</p>
              <p className="text-white/60 mt-1">
                1 bottle = 1L. Cost = Rs. 380. Batter, coffee, hot chocolate, and shake milk all count into milk bottles.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Ice</p>
              <p className="text-white/60 mt-1">
                1 bag = 1.5kg. Cost = Rs. 91. Cold coffee only. Estimated at 106.5g ice per 12oz cup.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Waffle Sauce</p>
              <p className="text-white/60 mt-1">
                Quarter = 20ml. Half = 30ml. Full = 40ml. KitKat waffle also uses Nutella sauce.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">KitKat</p>
              <p className="text-white/60 mt-1">
                Quarter = 1 finger. Half = 2 fingers. Full = 3 fingers. 1 pack = 2 fingers. Cost = Rs. 175.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Oreos</p>
              <p className="text-white/60 mt-1">
                Quarter = 2 biscuits. Half = 3 biscuits. Full = 4 biscuits. 1 packet = 4 biscuits. 8 packets = Rs. 282.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Dairy Milk</p>
              <p className="text-white/60 mt-1">
                Quarter = 12g. Half = 22g. Full = 32g. 1 bar = 56g. Cost = Rs. 250.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Marshmallows</p>
              <p className="text-white/60 mt-1">
                Quarter = 0.67 packet. Half = 1 packet. Full = 1.33 packets. 1 box = 18 packets. Cost = Rs. 180.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Chocolate Chips</p>
              <p className="text-white/60 mt-1">
                Quarter = 8g. Half = 12g. Full = 16g. 1 pack = 100g. Cost = Rs. 120.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Coffee</p>
              <p className="text-white/60 mt-1">
                Latte, espresso, americano = 12g. Cappuccino = 16g. 1 bag = 1kg. Cost = Rs. 8,100.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Coffee Syrups</p>
              <p className="text-white/60 mt-1">
                1L bottle = Rs. 2,300. Cold: Hazelnut 20ml, Caramel 25ml, Vanilla 25ml, Chocolate 30ml. Hot flavored latte = 10ml.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-bold">Sauces</p>
              <p className="text-white/60 mt-1">
                Nutella mixture bottle = Rs. 1,375 est. Hershey chocolate/strawberry = Rs. 1,450. Maple = Rs. 2,350.
              </p>
            </div>
          </div>
        </section>

        {groupedRows.length === 0 ? (
          <section className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-8 text-center text-white/60">
            No POS usage found for this month.
          </section>
        ) : (
          groupedRows.map((group) => {
            const sectionOpen = openSections[group.section] ?? true;
            const sectionCost = group.rows.reduce(
              (sum, row) => sum + Number(row.estimatedCost || 0),
              0
            );

            return (
              <section
                key={group.section}
                className="mt-5 rounded-[34px] bg-[#151922] border border-white/10 p-5"
              >
                <button
                  onClick={() => toggleSection(group.section)}
                  className="w-full flex items-center justify-between gap-3 mb-5 text-left"
                >
                  <div>
                    <h2 className="text-2xl font-bold">{group.section}</h2>
                    <p className="text-white/50 mt-1">
                      Estimated cost:{" "}
                      <span className="text-[#d81b72] font-bold">
                        {money(sectionCost)}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-[#d81b72] font-bold">
                      {group.rows.length} items
                    </p>
                    <span className="rounded-full bg-white/5 border border-white/10 px-4 py-2 font-bold">
                      {sectionOpen ? "Hide" : "Show"}
                    </span>
                  </div>
                </button>

                {sectionOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left text-white/50 text-sm">
                          <th className="px-4 py-2">Product</th>
                          <th className="px-4 py-2">Used</th>
                          <th className="px-4 py-2">Unit</th>
                          <th className="px-4 py-2">Bottle / Box / Pack Size</th>
                          <th className="px-4 py-2">Unit Cost</th>
                          <th className="px-4 py-2">Bottles / Boxes / Packs</th>
                          <th className="px-4 py-2">Estimated Cost</th>
                          <th className="px-4 py-2">Note</th>
                          <th className="px-4 py-2">Calculation</th>
                        </tr>
                      </thead>

                      <tbody>
                        {group.rows.map((row) => {
                          const rowKey = `${row.section}-${row.item}-${row.unit}`;
                          const isOpen = !!openRows[rowKey];

                          return (
                            <Fragment key={rowKey}>
                              <tr>
                                <td className="rounded-l-2xl bg-white/5 px-4 py-4 font-bold">
                                  {row.item}
                                </td>

                                <td className="bg-white/5 px-4 py-4">
                                  {row.used.toLocaleString()}
                                </td>

                                <td className="bg-white/5 px-4 py-4 text-white/70">
                                  {row.unit}
                                </td>

                                <td className="bg-white/5 px-4 py-4 text-white/70">
                                  {getPackDisplay(row)}
                                </td>

                                <td className="bg-white/5 px-4 py-4 text-white/70">
                                  {getPackCostDisplay(row)}
                                </td>

                                <td className="bg-white/5 px-4 py-4 font-bold text-[#d81b72]">
                                  {typeof row.packsUsed === "number"
                                    ? row.packsUsed.toLocaleString()
                                    : "-"}
                                </td>

                                <td className="bg-white/5 px-4 py-4 font-bold text-green-300">
                                  {row.estimatedCost
                                    ? money(row.estimatedCost)
                                    : "-"}
                                </td>

                                <td className="bg-white/5 px-4 py-4 text-white/55">
                                  {row.note || "-"}
                                </td>

                                <td className="rounded-r-2xl bg-white/5 px-4 py-4">
                                  <button
                                    onClick={() => toggleRow(rowKey)}
                                    className="rounded-xl bg-[#d81b72]/15 border border-[#d81b72]/25 px-4 py-2 text-pink-100 font-bold"
                                  >
                                    {isOpen ? "Hide" : "Show"}
                                  </button>
                                </td>
                              </tr>

                              {isOpen && (
                                <tr>
                                  <td colSpan={9} className="px-0 pb-2">
                                    <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
                                      <p className="font-bold text-[#d81b72] mb-3">
                                        How this was calculated
                                      </p>

                                      <div className="space-y-2">
                                        {row.calculations.map((calc, index) => (
                                          <div
                                            key={`${rowKey}-calc-${index}`}
                                            className="rounded-xl bg-white/5 px-4 py-3 text-white/75"
                                          >
                                            {calc}
                                          </div>
                                        ))}

                                        {row.packSize && row.packCost && (
                                          <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-green-200">
                                            Final cost: {round(row.used, 2)}{" "}
                                            {row.unit} ÷ {row.packSize}{" "}
                                            {row.unit} × {money(row.packCost)} ={" "}
                                            {money(getEstimatedCost(row))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
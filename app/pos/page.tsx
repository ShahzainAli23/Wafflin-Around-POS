"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  category: string;
  name: string;
  variant: string | null;
  size: string | null;
  price: number;
};

type Option = {
  id: string;
  option_group: string;
  name: string;
  price: number;
};

type CartItem = {
  product: Product;
  title: string;
  subtitle: string;
  quantity: number;
  selectedOptions: Option[];
  lineTotal: number;
};

type ActiveOrder = {
  id: string;
  order_no: number;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "cash" | "nayapay" | "meezan";
  created_at: string;
  status: string;
};

type ActiveOrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  line_total: number;
};

type ActiveOrderItemOption = {
  id: string;
  order_item_id: string;
  option_name: string;
  option_group: string;
  price: number;
};

type Screen =
  | "root"
  | "drinks-root"
  | "coffee-temp"
  | "coffee-hot"
  | "coffee-cold"
  | "shake-size"
  | "shake-flavor"
  | "waffles-root"
  | "build-size"
  | "build-sauce"
  | "build-topping"
  | "build-addons"
  | "kitkat-size"
  | "icecream-size"
  | "icecream-flavor"
  | "icecream-addons";

const waffleSizeLabel: Record<string, string> = {
  Small: "Quarter",
  Medium: "Half",
  Large: "Full",
};

const shakeSizeLabel: Record<string, string> = {
  Standard: "Regular",
  Large: "Large",
};

const scoopCountMap: Record<string, number> = {
  "1 Scoop": 1,
  "2 Scoop": 2,
  "3 Scoop": 3,
};

function formatWaffleSize(size: string | null) {
  if (!size) return "";
  return waffleSizeLabel[size] || size;
}

function formatShakeSize(size: string | null) {
  if (!size) return "";
  return shakeSizeLabel[size] || size;
}

function ChoiceCard({
  title,
  subtitle,
  price,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  price?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[24px] border border-[#ead8c2] bg-[#fff9f1] p-5 text-left shadow-[0_10px_25px_rgba(0,0,0,0.06)] transition ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:-translate-y-0.5 active:scale-[0.99]"
      }`}
    >
      <p className="text-xl font-bold text-[#241814]">{title}</p>
      {subtitle ? <p className="text-[#7b5b4f] mt-1">{subtitle}</p> : null}
      {typeof price === "number" ? (
        <p className="text-[#d81b72] font-bold text-lg mt-3">Rs. {price}</p>
      ) : null}
    </button>
  );
}

export default function POSPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "nayapay" | "meezan"
  >("cash");

  const [screen, setScreen] = useState<Screen>("root");
  const [history, setHistory] = useState<Screen[]>([]);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);

  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [activeOrderItems, setActiveOrderItems] = useState<ActiveOrderItem[]>(
    []
  );
  const [activeOrderItemOptions, setActiveOrderItemOptions] = useState<
    ActiveOrderItemOption[]
  >([]);

  const [selectedShakeSize, setSelectedShakeSize] =
    useState<string>("Standard");

  const [buildProduct, setBuildProduct] = useState<Product | null>(null);
  const [buildSauce, setBuildSauce] = useState<Option | null>(null);
  const [buildTopping, setBuildTopping] = useState<Option | null>(null);
  const [buildAddons, setBuildAddons] = useState<Option[]>([]);

  const [iceCreamProduct, setIceCreamProduct] = useState<Product | null>(null);
  const [iceCreamFlavorIds, setIceCreamFlavorIds] = useState<string[]>([]);
  const [iceCreamAddons, setIceCreamAddons] = useState<Option[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => {
      setNotice("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [notice]);

  async function loadData() {
    setIsLoading(true);

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

    if (profile?.role === "admin") {
      router.push("/admin");
      return;
    }

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true);

    const { data: optionData, error: optionError } = await supabase
      .from("options")
      .select("*")
      .eq("is_active", true);

    if (productError || optionError) {
      setNotice("Could not load menu");
      setIsLoading(false);
      return;
    }

    setProducts((productData || []) as Product[]);
    setOptions((optionData || []) as Option[]);

    await loadActiveOrders(user.id);

    setIsLoading(false);
  }

  async function loadActiveOrders(userId?: string) {
    let workerId = userId;

    if (!workerId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      workerId = user.id;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_no, subtotal, discount, total, payment_method, created_at, status"
      )
      .eq("worker_id", workerId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (orderError) {
      setNotice("Could not load active orders");
      return;
    }

    const safeOrders = (orderData || []) as ActiveOrder[];
    setActiveOrders(safeOrders);

    const orderIds = safeOrders.map((order) => order.id);

    if (orderIds.length === 0) {
      setActiveOrderItems([]);
      setActiveOrderItemOptions([]);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, quantity, line_total")
      .in("order_id", orderIds);

    if (itemError) {
      setActiveOrderItems([]);
      setActiveOrderItemOptions([]);
      return;
    }

    const safeItems = (itemData || []) as ActiveOrderItem[];
    setActiveOrderItems(safeItems);

    const itemIds = safeItems.map((item) => item.id);

    if (itemIds.length === 0) {
      setActiveOrderItemOptions([]);
      return;
    }

    const { data: optionData, error: optionError } = await supabase
      .from("order_item_options")
      .select("id, order_item_id, option_name, option_group, price")
      .in("order_item_id", itemIds);

    if (optionError) {
      setActiveOrderItemOptions([]);
      return;
    }

    setActiveOrderItemOptions((optionData || []) as ActiveOrderItemOption[]);
  }

  const activeItemsByOrderId = useMemo(() => {
    const map = new Map<string, ActiveOrderItem[]>();

    activeOrderItems.forEach((item) => {
      const existing = map.get(item.order_id) || [];
      existing.push(item);
      map.set(item.order_id, existing);
    });

    return map;
  }, [activeOrderItems]);

  const activeOptionsByItemId = useMemo(() => {
    const map = new Map<string, ActiveOrderItemOption[]>();

    activeOrderItemOptions.forEach((option) => {
      const existing = map.get(option.order_item_id) || [];
      existing.push(option);
      map.set(option.order_item_id, existing);
    });

    return map;
  }, [activeOrderItemOptions]);

  async function updateOrderStatus(
    orderId: string,
    status: "completed" | "cancelled"
  ) {
    if (isUpdatingOrder || isCheckingOut) return;

    setIsUpdatingOrder(true);
    setNotice(
      status === "completed" ? "Completing order..." : "Cancelling order..."
    );

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId)
        .eq("worker_id", user.id);

      if (error) {
        setNotice("Could not update order");
        return;
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: status === "completed" ? "ORDER_COMPLETED" : "ORDER_CANCELLED",
        details: {
          orderId,
          status,
        },
      });

      await loadActiveOrders(user.id);
      setNotice(status === "completed" ? "Order completed" : "Order cancelled");
    } finally {
      setIsUpdatingOrder(false);
    }
  }

  function navigate(next: Screen) {
    if (isCheckingOut || isUpdatingOrder) return;
    setHistory((prev) => [...prev, screen]);
    setScreen(next);
  }

  function goBack() {
    if (isCheckingOut || isUpdatingOrder) return;
    if (history.length === 0) return;

    const nextHistory = [...history];
    const previous = nextHistory.pop()!;

    setHistory(nextHistory);
    setScreen(previous);
  }

  function goHome() {
    if (isCheckingOut || isUpdatingOrder) return;
    setHistory([]);
    setScreen("root");
  }

  function resetBuildFlow() {
    setBuildProduct(null);
    setBuildSauce(null);
    setBuildTopping(null);
    setBuildAddons([]);
  }

  function resetIceCreamFlow() {
    setIceCreamProduct(null);
    setIceCreamFlavorIds([]);
    setIceCreamAddons([]);
  }

  const freeSauces = useMemo(() => {
    return options.filter((o) => o.option_group === "Free Sauce");
  }, [options]);

  const freeToppings = useMemo(() => {
    return options.filter((o) => o.option_group === "Free Topping");
  }, [options]);

  const addOns = useMemo(() => {
    return options.filter((o) => o.option_group === "Add-on");
  }, [options]);

  const iceCreamFlavorOptions = useMemo(() => {
    return options.filter((o) => o.option_group === "Ice Cream Flavor");
  }, [options]);

  const buildWaffleProducts = useMemo(() => {
    return products.filter(
      (p) => p.category === "Waffles" && p.name === "Waffle"
    );
  }, [products]);

  const kitkatProducts = useMemo(() => {
    return products.filter(
      (p) => p.category === "Waffles" && p.name === "Kit Kat Waffle"
    );
  }, [products]);

  const hotCoffeeProducts = useMemo(() => {
    return products.filter(
      (p) => p.category === "Drinks" && p.variant === "Hot"
    );
  }, [products]);

  const coldCoffeeProducts = useMemo(() => {
    return products.filter(
      (p) => p.category === "Drinks" && p.variant === "Cold"
    );
  }, [products]);

  const shakeProducts = useMemo(() => {
    return products.filter((p) => p.category === "Ice Cream Shakes");
  }, [products]);

  const selectedShakeProducts = useMemo(() => {
    return shakeProducts.filter((p) => p.size === selectedShakeSize);
  }, [shakeProducts, selectedShakeSize]);

  const iceCreamProducts = useMemo(() => {
    return products.filter((p) => p.category === "Ice Cream");
  }, [products]);

  const filteredIceCreamAddons = useMemo(() => {
    return addOns.filter((o) => o.name !== "Ice Cream Scoop");
  }, [addOns]);

  function addToCart(item: CartItem) {
    if (isCheckingOut || isUpdatingOrder) return;

    setCart((prev) => [...prev, item]);
    setNotice("Item added to cart");
    setHistory([]);
    setScreen("root");
  }

  function addSimpleProduct(product: Product, title?: string, subtitle?: string) {
    addToCart({
      product,
      title: title || product.name,
      subtitle:
        subtitle ||
        [product.variant, formatShakeSize(product.size)]
          .filter(Boolean)
          .join(" "),
      quantity: 1,
      selectedOptions: [],
      lineTotal: Number(product.price),
    });
  }

  function toggleOption(
    current: Option[],
    option: Option,
    setter: (value: Option[]) => void
  ) {
    if (isCheckingOut || isUpdatingOrder) return;

    if (current.some((o) => o.id === option.id)) {
      setter(current.filter((o) => o.id !== option.id));
    } else {
      setter([...current, option]);
    }
  }

  function confirmBuildWaffle() {
    if (isCheckingOut || isUpdatingOrder) return;

    if (!buildProduct || !buildSauce || !buildTopping) {
      setNotice("Select sauce and topping first");
      return;
    }

    const selectedOptions = [buildSauce, buildTopping, ...buildAddons];

    const extras = selectedOptions.reduce((sum, item) => {
      return sum + Number(item.price);
    }, 0);

    addToCart({
      product: buildProduct,
      title: "Build a Waffle",
      subtitle: formatWaffleSize(buildProduct.size),
      quantity: 1,
      selectedOptions,
      lineTotal: Number(buildProduct.price) + extras,
    });

    resetBuildFlow();
  }

  function addIceCreamFlavor(id: string) {
    if (isCheckingOut || isUpdatingOrder) return;
    if (!iceCreamProduct) return;

    const maxFlavors = scoopCountMap[iceCreamProduct.size || "1 Scoop"] || 1;

    if (iceCreamFlavorIds.length >= maxFlavors) {
      setNotice(`Only ${maxFlavors} flavor${maxFlavors > 1 ? "s" : ""}`);
      return;
    }

    setIceCreamFlavorIds((prev) => [...prev, id]);
  }

  function removeLastIceCreamFlavor() {
    if (isCheckingOut || isUpdatingOrder) return;

    setIceCreamFlavorIds((prev) => prev.slice(0, -1));
  }

  function confirmIceCream() {
    if (isCheckingOut || isUpdatingOrder) return;

    if (!iceCreamProduct) {
      setNotice("Choose ice cream size first");
      return;
    }

    const maxFlavors = scoopCountMap[iceCreamProduct.size || "1 Scoop"] || 1;

    if (iceCreamFlavorIds.length !== maxFlavors) {
      setNotice(`Choose ${maxFlavors} flavor${maxFlavors > 1 ? "s" : ""}`);
      return;
    }

    const flavorOptions = iceCreamFlavorIds
      .map((id) => iceCreamFlavorOptions.find((o) => o.id === id))
      .filter(Boolean) as Option[];

    const selectedOptions = [...flavorOptions, ...iceCreamAddons];

    const extras = selectedOptions.reduce((sum, item) => {
      return sum + Number(item.price);
    }, 0);

    addToCart({
      product: iceCreamProduct,
      title: "Ice Cream",
      subtitle: iceCreamProduct.size || "",
      quantity: 1,
      selectedOptions,
      lineTotal: Number(iceCreamProduct.price) + extras,
    });

    resetIceCreamFlow();
  }

  function removeItem(index: number) {
    if (isCheckingOut || isUpdatingOrder) return;

    setCart((prev) => {
      const next = prev.filter((_, i) => i !== index);

      if (next.length === 0) {
        setDiscountApplied(false);
      }

      return next;
    });
  }

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (!discountApplied) return 0;
    return Math.round(subtotal * 0.2);
  }, [subtotal, discountApplied]);

  const total = useMemo(() => {
    return subtotal - discountAmount;
  }, [subtotal, discountAmount]);

  function toggleDiscount() {
    if (isCheckingOut || isUpdatingOrder) return;

    if (cart.length === 0) {
      setNotice("Add items first");
      return;
    }

    setDiscountApplied((prev) => !prev);
  }

  async function checkout() {
    if (isCheckingOut || isUpdatingOrder) return;

    if (cart.length === 0) {
      setNotice("Cart is empty");
      return;
    }

    setIsCheckingOut(true);
    setNotice("Saving order...");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const currentCart = [...cart];
      const currentSubtotal = subtotal;
      const currentDiscount = discountAmount;
      const currentTotal = total;
      const currentPaymentMethod = paymentMethod;
      const loyaltyDiscountApplied = discountApplied;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          worker_id: user.id,
          subtotal: currentSubtotal,
          discount: currentDiscount,
          total: currentTotal,
          payment_method: currentPaymentMethod,
          status: "active",
        })
        .select()
        .single();

      if (orderError || !order) {
        setNotice("Order failed");
        return;
      }

      for (const item of currentCart) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product.id,
            product_name: item.title,
            category: item.product.category,
            quantity: item.quantity,
            unit_price: item.product.price,
            line_total: item.lineTotal,
          })
          .select()
          .single();

        if (itemError || !orderItem) {
          setNotice("Order item failed");
          return;
        }

        if (item.selectedOptions.length > 0) {
          const { error: optionError } = await supabase
            .from("order_item_options")
            .insert(
              item.selectedOptions.map((o) => ({
                order_item_id: orderItem.id,
                option_name: o.name,
                option_group: o.option_group,
                price: o.price,
              }))
            );

          if (optionError) {
            setNotice("Order options failed");
            return;
          }
        }
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "ORDER_CREATED",
        details: {
          subtotal: currentSubtotal,
          discount: currentDiscount,
          total: currentTotal,
          paymentMethod: currentPaymentMethod,
          items: currentCart.length,
          status: "active",
          loyaltyDiscountApplied,
        },
      });

      setCart([]);
      setPaymentMethod("cash");
      setDiscountApplied(false);
      setHistory([]);
      setScreen("root");
      await loadActiveOrders(user.id);
      setNotice("Order added to active orders");
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function logout() {
    if (isCheckingOut || isUpdatingOrder) return;

    await supabase.auth.signOut();
    router.push("/login");
  }

  function renderMainContent() {
    if (isLoading) {
      return (
        <div className="min-h-[360px] flex flex-col items-center justify-center text-[#7b5b4f]">
          <span className="h-5 w-5 rounded-full bg-[#d81b72] animate-pulse" />
          <p className="mt-3 font-bold">Loading menu...</p>
        </div>
      );
    }

    if (screen === "root") {
      return (
        <div className="grid md:grid-cols-3 gap-4">
          <ChoiceCard
            title="Drinks"
            subtitle="Coffee and shakes"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("drinks-root")}
          />
          <ChoiceCard
            title="Waffles"
            subtitle="Build or Kit Kat"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("waffles-root")}
          />
          <ChoiceCard
            title="Ice Cream"
            subtitle="1, 2 or 3 scoops"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("icecream-size")}
          />
        </div>
      );
    }

    if (screen === "drinks-root") {
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <ChoiceCard
            title="Coffee"
            subtitle="Hot or cold"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("coffee-temp")}
          />
          <ChoiceCard
            title="Ice Cream Shakes"
            subtitle="Regular or large"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("shake-size")}
          />
        </div>
      );
    }

    if (screen === "coffee-temp") {
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <ChoiceCard
            title="Hot"
            subtitle="All hot coffees"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("coffee-hot")}
          />
          <ChoiceCard
            title="Cold"
            subtitle="All cold coffees"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("coffee-cold")}
          />
        </div>
      );
    }

    if (screen === "coffee-hot") {
      return (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {hotCoffeeProducts.map((product) => (
            <ChoiceCard
              key={product.id}
              title={product.name}
              subtitle="Hot"
              price={Number(product.price)}
              disabled={isCheckingOut || isUpdatingOrder}
              onClick={() => addSimpleProduct(product, product.name, "Hot")}
            />
          ))}
        </div>
      );
    }

    if (screen === "coffee-cold") {
      return (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {coldCoffeeProducts.map((product) => (
            <ChoiceCard
              key={product.id}
              title={product.name}
              subtitle="Cold"
              price={Number(product.price)}
              disabled={isCheckingOut || isUpdatingOrder}
              onClick={() => addSimpleProduct(product, product.name, "Cold")}
            />
          ))}
        </div>
      );
    }

    if (screen === "shake-size") {
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <ChoiceCard
            title="Regular"
            subtitle="Standard size"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => {
              setSelectedShakeSize("Standard");
              navigate("shake-flavor");
            }}
          />
          <ChoiceCard
            title="Large"
            subtitle="Large size"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => {
              setSelectedShakeSize("Large");
              navigate("shake-flavor");
            }}
          />
        </div>
      );
    }

    if (screen === "shake-flavor") {
      return (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {selectedShakeProducts.map((product) => (
            <ChoiceCard
              key={product.id}
              title={product.name.replace(" Shake", "")}
              subtitle={formatShakeSize(product.size)}
              price={Number(product.price)}
              disabled={isCheckingOut || isUpdatingOrder}
              onClick={() =>
                addSimpleProduct(
                  product,
                  product.name,
                  formatShakeSize(product.size)
                )
              }
            />
          ))}
        </div>
      );
    }

    if (screen === "waffles-root") {
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <ChoiceCard
            title="Build a Waffle"
            subtitle="Pick size, sauce, topping and add-ons"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => {
              resetBuildFlow();
              navigate("build-size");
            }}
          />
          <ChoiceCard
            title="Kit Kat Waffle"
            subtitle="Choose size"
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={() => navigate("kitkat-size")}
          />
        </div>
      );
    }

    if (screen === "kitkat-size") {
      return (
        <div className="grid md:grid-cols-3 gap-4">
          {kitkatProducts.map((product) => (
            <ChoiceCard
              key={product.id}
              title={formatWaffleSize(product.size)}
              subtitle="Kit Kat Waffle"
              price={Number(product.price)}
              disabled={isCheckingOut || isUpdatingOrder}
              onClick={() =>
                addSimpleProduct(
                  product,
                  "Kit Kat Waffle",
                  formatWaffleSize(product.size)
                )
              }
            />
          ))}
        </div>
      );
    }

    if (screen === "build-size") {
      return (
        <div className="grid md:grid-cols-3 gap-4">
          {buildWaffleProducts.map((product) => (
            <ChoiceCard
              key={product.id}
              title={formatWaffleSize(product.size)}
              subtitle="Build a Waffle"
              price={Number(product.price)}
              disabled={isCheckingOut || isUpdatingOrder}
              onClick={() => {
                setBuildProduct(product);
                navigate("build-sauce");
              }}
            />
          ))}
        </div>
      );
    }

    if (screen === "build-sauce") {
      return (
        <div className="space-y-4">
          <p className="text-lg font-bold text-[#241814]">Choose 1 sauce</p>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {freeSauces.map((option) => (
              <button
                key={option.id}
                disabled={isCheckingOut || isUpdatingOrder}
                onClick={() => setBuildSauce(option)}
                className={`rounded-[22px] border p-5 text-left ${
                  buildSauce?.id === option.id
                    ? "bg-[#d81b72] text-white border-[#d81b72]"
                    : "bg-[#fff9f1] text-[#241814] border-[#ead8c2]"
                } ${
                  isCheckingOut || isUpdatingOrder
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                <p className="font-bold text-lg">{option.name}</p>
              </button>
            ))}
          </div>

          <button
            disabled={!buildSauce || isCheckingOut || isUpdatingOrder}
            onClick={() => buildSauce && navigate("build-topping")}
            className={`rounded-2xl px-5 py-3 font-bold ${
              !buildSauce || isCheckingOut || isUpdatingOrder
                ? "bg-[#9d8a82] text-white cursor-not-allowed"
                : "bg-[#241814] text-white"
            }`}
          >
            Next
          </button>
        </div>
      );
    }

    if (screen === "build-topping") {
      return (
        <div className="space-y-4">
          <p className="text-lg font-bold text-[#241814]">Choose 1 topping</p>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {freeToppings.map((option) => (
              <button
                key={option.id}
                disabled={isCheckingOut || isUpdatingOrder}
                onClick={() => setBuildTopping(option)}
                className={`rounded-[22px] border p-5 text-left ${
                  buildTopping?.id === option.id
                    ? "bg-[#d81b72] text-white border-[#d81b72]"
                    : "bg-[#fff9f1] text-[#241814] border-[#ead8c2]"
                } ${
                  isCheckingOut || isUpdatingOrder
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
              >
                <p className="font-bold text-lg">{option.name}</p>
              </button>
            ))}
          </div>

          <button
            disabled={!buildTopping || isCheckingOut || isUpdatingOrder}
            onClick={() => buildTopping && navigate("build-addons")}
            className={`rounded-2xl px-5 py-3 font-bold ${
              !buildTopping || isCheckingOut || isUpdatingOrder
                ? "bg-[#9d8a82] text-white cursor-not-allowed"
                : "bg-[#241814] text-white"
            }`}
          >
            Next
          </button>
        </div>
      );
    }

    if (screen === "build-addons") {
      return (
        <div className="space-y-4">
          <p className="text-lg font-bold text-[#241814]">Add-ons</p>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {addOns.map((option) => {
              const active = buildAddons.some((o) => o.id === option.id);

              return (
                <button
                  key={option.id}
                  disabled={isCheckingOut || isUpdatingOrder}
                  onClick={() =>
                    toggleOption(buildAddons, option, setBuildAddons)
                  }
                  className={`rounded-[22px] border p-5 text-left ${
                    active
                      ? "bg-[#d81b72] text-white border-[#d81b72]"
                      : "bg-[#fff9f1] text-[#241814] border-[#ead8c2]"
                  } ${
                    isCheckingOut || isUpdatingOrder
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <p className="font-bold text-lg">{option.name}</p>
                  <p
                    className={`${
                      active ? "text-white/80" : "text-[#7b5b4f]"
                    } mt-1`}
                  >
                    + Rs. {option.price}
                  </p>
                </button>
              );
            })}
          </div>

          <button
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={confirmBuildWaffle}
            className={`rounded-2xl px-5 py-3 font-bold shadow-[0_10px_25px_rgba(216,27,114,0.35)] ${
              isCheckingOut || isUpdatingOrder
                ? "bg-[#9d8a82] text-white cursor-not-allowed"
                : "bg-[#d81b72] text-white"
            }`}
          >
            Add to cart
          </button>
        </div>
      );
    }

    if (screen === "icecream-size") {
      return (
        <div className="grid md:grid-cols-3 gap-4">
          {iceCreamProducts.map((product) => (
            <ChoiceCard
              key={product.id}
              title={product.size || ""}
              subtitle="Ice Cream"
              price={Number(product.price)}
              disabled={isCheckingOut || isUpdatingOrder}
              onClick={() => {
                resetIceCreamFlow();
                setIceCreamProduct(product);
                navigate("icecream-flavor");
              }}
            />
          ))}
        </div>
      );
    }

    if (screen === "icecream-flavor") {
      const maxFlavors = iceCreamProduct
        ? scoopCountMap[iceCreamProduct.size || "1 Scoop"] || 1
        : 1;

      const selectedFlavorText =
        iceCreamFlavorIds.length === 0
          ? "None selected"
          : iceCreamFlavorIds
              .map(
                (id) =>
                  iceCreamFlavorOptions.find((option) => option.id === id)?.name
              )
              .filter(Boolean)
              .join(" + ");

      return (
        <div className="space-y-4">
          <p className="text-lg font-bold text-[#241814]">
            Choose {maxFlavors} flavor{maxFlavors > 1 ? "s" : ""}
          </p>

          <div className="rounded-2xl bg-[#fff9f1] border border-[#ead8c2] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#8b4b39]">
                  Selected Flavors
                </p>
                <p className="mt-1 font-bold text-[#241814]">
                  {selectedFlavorText}
                </p>
                <p className="text-sm text-[#7b5b4f] mt-1">
                  {iceCreamFlavorIds.length} / {maxFlavors} selected
                </p>
              </div>

              <button
                onClick={removeLastIceCreamFlavor}
                disabled={
                  iceCreamFlavorIds.length === 0 ||
                  isCheckingOut ||
                  isUpdatingOrder
                }
                className={`rounded-xl px-4 py-2 font-bold ${
                  iceCreamFlavorIds.length === 0 ||
                  isCheckingOut ||
                  isUpdatingOrder
                    ? "bg-[#9d8a82] text-white cursor-not-allowed"
                    : "bg-[#241814] text-white"
                }`}
              >
                Undo Last
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {iceCreamFlavorOptions.map((option) => {
              const selectedCount = iceCreamFlavorIds.filter(
                (id) => id === option.id
              ).length;

              const active = selectedCount > 0;
              const maxReached = iceCreamFlavorIds.length >= maxFlavors;

              return (
                <button
                  key={option.id}
                  disabled={isCheckingOut || isUpdatingOrder || maxReached}
                  onClick={() => addIceCreamFlavor(option.id)}
                  className={`rounded-[22px] border p-5 text-left ${
                    active
                      ? "bg-[#d81b72] text-white border-[#d81b72]"
                      : "bg-[#fff9f1] text-[#241814] border-[#ead8c2]"
                  } ${
                    isCheckingOut || isUpdatingOrder || maxReached
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <p className="font-bold text-lg">{option.name}</p>

                  {selectedCount > 0 && (
                    <p className="mt-2 text-sm font-bold">
                      Selected x{selectedCount}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <button
            disabled={
              iceCreamFlavorIds.length !== maxFlavors ||
              isCheckingOut ||
              isUpdatingOrder
            }
            onClick={() => {
              if (iceCreamFlavorIds.length === maxFlavors) {
                navigate("icecream-addons");
              }
            }}
            className={`rounded-2xl px-5 py-3 font-bold ${
              iceCreamFlavorIds.length !== maxFlavors ||
              isCheckingOut ||
              isUpdatingOrder
                ? "bg-[#9d8a82] text-white cursor-not-allowed"
                : "bg-[#241814] text-white"
            }`}
          >
            Next
          </button>
        </div>
      );
    }

    if (screen === "icecream-addons") {
      return (
        <div className="space-y-4">
          <p className="text-lg font-bold text-[#241814]">Add-ons</p>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {filteredIceCreamAddons.map((option) => {
              const active = iceCreamAddons.some((o) => o.id === option.id);

              return (
                <button
                  key={option.id}
                  disabled={isCheckingOut || isUpdatingOrder}
                  onClick={() =>
                    toggleOption(iceCreamAddons, option, setIceCreamAddons)
                  }
                  className={`rounded-[22px] border p-5 text-left ${
                    active
                      ? "bg-[#d81b72] text-white border-[#d81b72]"
                      : "bg-[#fff9f1] text-[#241814] border-[#ead8c2]"
                  } ${
                    isCheckingOut || isUpdatingOrder
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <p className="font-bold text-lg">{option.name}</p>
                  <p
                    className={`${
                      active ? "text-white/80" : "text-[#7b5b4f]"
                    } mt-1`}
                  >
                    + Rs. {option.price}
                  </p>
                </button>
              );
            })}
          </div>

          <button
            disabled={isCheckingOut || isUpdatingOrder}
            onClick={confirmIceCream}
            className={`rounded-2xl px-5 py-3 font-bold shadow-[0_10px_25px_rgba(216,27,114,0.35)] ${
              isCheckingOut || isUpdatingOrder
                ? "bg-[#9d8a82] text-white cursor-not-allowed"
                : "bg-[#d81b72] text-white"
            }`}
          >
            Add to cart
          </button>
        </div>
      );
    }

    return null;
  }

  const pageTitle =
    {
      root: "Choose category",
      "drinks-root": "Drinks",
      "coffee-temp": "Coffee",
      "coffee-hot": "Hot coffee",
      "coffee-cold": "Cold coffee",
      "shake-size": "Ice Cream Shakes",
      "shake-flavor": `Shakes - ${formatShakeSize(selectedShakeSize)}`,
      "waffles-root": "Waffles",
      "build-size": "Build a Waffle",
      "build-sauce": "Build a Waffle - Sauce",
      "build-topping": "Build a Waffle - Topping",
      "build-addons": "Build a Waffle - Add-ons",
      "kitkat-size": "Kit Kat Waffle",
      "icecream-size": "Ice Cream",
      "icecream-flavor": "Ice Cream - Flavors",
      "icecream-addons": "Ice Cream - Add-ons",
    }[screen] || "Worker POS";

  const isBusy = isCheckingOut || isUpdatingOrder;

  return (
    <main className="min-h-screen bg-[#f7eedf] p-4 lg:p-6">
      {isBusy && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-[28px] bg-[#fff9f1] border border-[#ead8c2] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.25)] text-center">
            <span className="mx-auto block h-8 w-8 rounded-full bg-[#d81b72] animate-pulse" />
            <h2 className="mt-4 text-2xl font-bold text-[#241814]">
              {isCheckingOut ? "Processing order" : "Updating order"}
            </h2>
            <p className="mt-2 text-[#7b5b4f]">Please wait.</p>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="rounded-[30px] border border-[#ead8c2] bg-[#fff9f1] px-5 py-4 shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Wafflin' Around"
              className="h-12 w-12 object-contain rounded-2xl"
            />

            {screen !== "root" ? (
              <button
                onClick={goBack}
                disabled={isBusy}
                className={`rounded-2xl px-4 py-2 font-bold ${
                  isBusy
                    ? "bg-[#9d8a82] text-white cursor-not-allowed"
                    : "bg-[#241814] text-white"
                }`}
              >
                Back
              </button>
            ) : null}

            <button
              onClick={goHome}
              disabled={isBusy}
              className={`rounded-2xl border border-[#ead8c2] bg-white px-4 py-2 font-bold text-[#241814] ${
                isBusy ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              Home
            </button>

            <div>
              <p className="text-sm text-[#8b6a5b]">Worker POS</p>
              <h1 className="text-2xl lg:text-3xl font-bold text-[#241814]">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {notice ? (
              <div className="rounded-2xl bg-[#ffe5f1] text-[#a10d52] px-4 py-2 font-bold">
                {notice}
              </div>
            ) : null}

            <button
              onClick={logout}
              disabled={isBusy}
              className={`rounded-2xl px-4 py-2 font-bold ${
                isBusy
                  ? "bg-[#9d8a82] text-white cursor-not-allowed"
                  : "bg-[#d81b72] text-white"
              }`}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-5 grid xl:grid-cols-[1fr_380px] gap-5">
          <div className="space-y-5">
            <section className="rounded-[30px] border border-[#ead8c2] bg-[#fef8ef] p-5 lg:p-6 shadow-[0_15px_35px_rgba(0,0,0,0.05)]">
              {renderMainContent()}
            </section>

            <section className="rounded-[30px] border border-[#ead8c2] bg-[#fff9f1] p-5 lg:p-6 shadow-[0_15px_35px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[#8b6a5b]">Kitchen / Counter</p>
                  <h2 className="text-2xl lg:text-3xl font-bold text-[#241814]">
                    Active Orders
                  </h2>
                </div>

                <button
                  onClick={() => loadActiveOrders()}
                  disabled={isBusy}
                  className={`rounded-2xl px-4 py-2 font-bold ${
                    isBusy
                      ? "bg-[#9d8a82] text-white cursor-not-allowed"
                      : "bg-[#241814] text-white"
                  }`}
                >
                  Refresh
                </button>
              </div>

              <div className="mt-5">
                {activeOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#ead8c2] bg-[#fef8ef] p-6 text-center text-[#7b5b4f] font-bold">
                    No active orders
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeOrders.map((order) => {
                      const items = activeItemsByOrderId.get(order.id) || [];

                      return (
                        <div
                          key={order.id}
                          className="rounded-[26px] border border-[#ead8c2] bg-white p-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-[#8b6a5b]">
                                Order #{order.order_no}
                              </p>

                              {Number(order.discount) > 0 ? (
                                <div>
                                  <p className="text-sm text-[#7b5b4f] line-through mt-1">
                                    Rs. {order.subtotal}
                                  </p>
                                  <h3 className="text-2xl font-bold text-[#241814]">
                                    Rs. {order.total}
                                  </h3>
                                  <p className="text-sm font-bold text-[#d81b72]">
                                    Loyalty discount: - Rs. {order.discount}
                                  </p>
                                </div>
                              ) : (
                                <h3 className="text-2xl font-bold text-[#241814] mt-1">
                                  Rs. {order.total}
                                </h3>
                              )}
                            </div>

                            <span className="rounded-full bg-[#ffe5f1] text-[#a10d52] px-3 py-1 text-sm font-bold capitalize">
                              {order.payment_method}
                            </span>
                          </div>

                          <p className="text-sm text-[#7b5b4f] mt-2">
                            {new Date(order.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>

                          <div className="mt-4 space-y-3">
                            {items.length === 0 ? (
                              <p className="text-sm text-[#7b5b4f]">
                                No items found
                              </p>
                            ) : (
                              items.map((item) => {
                                const itemOptions =
                                  activeOptionsByItemId.get(item.id) || [];

                                const sauceOptions = itemOptions.filter(
                                  (option) =>
                                    option.option_group === "Free Sauce"
                                );

                                const toppingOptions = itemOptions.filter(
                                  (option) =>
                                    option.option_group === "Free Topping"
                                );

                                const addonOptions = itemOptions.filter(
                                  (option) => option.option_group === "Add-on"
                                );

                                const flavorOptions = itemOptions.filter(
                                  (option) =>
                                    option.option_group === "Ice Cream Flavor"
                                );

                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-2xl bg-[#f7eedf] px-4 py-3 border border-[#ead8c2]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-bold text-[#241814] text-lg">
                                          {item.product_name}
                                        </p>
                                        <p className="text-sm text-[#7b5b4f]">
                                          Qty {item.quantity} | Rs.{" "}
                                          {item.line_total}
                                        </p>
                                      </div>
                                    </div>

                                    {flavorOptions.length > 0 && (
                                      <div className="mt-3 rounded-xl bg-white px-3 py-2">
                                        <p className="text-xs font-bold text-[#8b4b39] uppercase">
                                          Ice Cream Flavor
                                        </p>
                                        <p className="font-bold text-[#241814] mt-1">
                                          {flavorOptions
                                            .map(
                                              (option) => option.option_name
                                            )
                                            .join(" + ")}
                                        </p>
                                      </div>
                                    )}

                                    {sauceOptions.length > 0 && (
                                      <div className="mt-3 rounded-xl bg-white px-3 py-2">
                                        <p className="text-xs font-bold text-[#8b4b39] uppercase">
                                          Sauce
                                        </p>
                                        <p className="font-bold text-[#241814] mt-1">
                                          {sauceOptions
                                            .map(
                                              (option) => option.option_name
                                            )
                                            .join(", ")}
                                        </p>
                                      </div>
                                    )}

                                    {toppingOptions.length > 0 && (
                                      <div className="mt-3 rounded-xl bg-white px-3 py-2">
                                        <p className="text-xs font-bold text-[#8b4b39] uppercase">
                                          Topping
                                        </p>
                                        <p className="font-bold text-[#241814] mt-1">
                                          {toppingOptions
                                            .map(
                                              (option) => option.option_name
                                            )
                                            .join(", ")}
                                        </p>
                                      </div>
                                    )}

                                    {addonOptions.length > 0 && (
                                      <div className="mt-3 rounded-xl bg-white px-3 py-2">
                                        <p className="text-xs font-bold text-[#8b4b39] uppercase">
                                          Add-ons
                                        </p>

                                        <div className="mt-1 space-y-1">
                                          {addonOptions.map((option) => (
                                            <p
                                              key={option.id}
                                              className="font-bold text-[#241814]"
                                            >
                                              {option.option_name}
                                              {Number(option.price) > 0
                                                ? ` + Rs. ${option.price}`
                                                : ""}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {itemOptions.length === 0 && (
                                      <p className="mt-3 text-sm text-[#7b5b4f]">
                                        No customization
                                      </p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-5">
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                updateOrderStatus(order.id, "cancelled")
                              }
                              className={`rounded-2xl border border-red-200 bg-red-50 py-3 font-bold text-red-700 ${
                                isBusy ? "opacity-60 cursor-not-allowed" : ""
                              }`}
                            >
                              Cancel
                            </button>

                            <button
                              disabled={isBusy}
                              onClick={() =>
                                updateOrderStatus(order.id, "completed")
                              }
                              className={`rounded-2xl bg-[#d81b72] py-3 font-bold text-white ${
                                isBusy ? "opacity-60 cursor-not-allowed" : ""
                              }`}
                            >
                              Complete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="rounded-[30px] border border-[#ead8c2] bg-[#fff9f1] p-5 shadow-[0_15px_35px_rgba(0,0,0,0.06)] h-fit xl:sticky xl:top-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#241814]">Cart</h2>
              <span className="rounded-full bg-[#241814] text-white min-w-9 h-9 flex items-center justify-center font-bold">
                {cart.length}
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[420px] overflow-auto pr-1">
              {cart.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#ead8c2] p-5 text-center text-[#7b5b4f]">
                  No items yet
                </div>
              ) : (
                cart.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-[24px] border border-[#ead8c2] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#241814] text-lg">
                          {item.title}
                        </p>
                        <p className="text-[#7b5b4f]">{item.subtitle}</p>
                      </div>

                      <button
                        onClick={() => removeItem(index)}
                        disabled={isBusy}
                        className={`rounded-xl border border-[#f4d6df] bg-[#fff2f7] px-3 py-1.5 text-sm font-bold text-[#a10d52] ${
                          isBusy ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      >
                        Remove
                      </button>
                    </div>

                    {item.selectedOptions.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {item.selectedOptions.map((option, i) => (
                          <p
                            key={`${option.id}-${i}`}
                            className="text-sm text-[#6d554a]"
                          >
                            {option.option_group}: {option.name}
                            {Number(option.price) > 0
                              ? ` (+ Rs. ${option.price})`
                              : ""}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <p className="text-[#d81b72] font-bold text-lg mt-3">
                      Rs. {item.lineTotal}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-[#ead8c2] pt-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[#7b5b4f] font-bold">Subtotal</p>
                  <p className="text-xl font-bold text-[#241814]">
                    Rs. {subtotal}
                  </p>
                </div>

                <button
                  onClick={toggleDiscount}
                  disabled={isBusy || cart.length === 0}
                  className={`w-full rounded-2xl border py-3 font-bold ${
                    discountApplied
                      ? "bg-[#ffe5f1] border-[#d81b72] text-[#a10d52]"
                      : "bg-white border-[#ead8c2] text-[#241814]"
                  } ${
                    isBusy || cart.length === 0
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {discountApplied
                    ? "Remove 20% Loyalty Discount"
                    : "Apply 20% Loyalty Discount"}
                </button>

                {discountApplied && (
                  <div className="flex items-center justify-between rounded-2xl bg-[#ffe5f1] px-4 py-3">
                    <p className="text-[#a10d52] font-bold">Discount 20%</p>
                    <p className="text-[#a10d52] font-bold">
                      - Rs. {discountAmount}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[#ead8c2] pt-4">
                  <p className="text-[#7b5b4f] font-bold">Total</p>
                  <p className="text-3xl font-bold text-[#241814]">
                    Rs. {total}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold text-[#241814] mb-3">
                  Payment
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "nayapay", "meezan"] as const).map((method) => (
                    <button
                      key={method}
                      disabled={isBusy}
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-2xl px-3 py-3 font-bold capitalize border ${
                        paymentMethod === method
                          ? "bg-[#d81b72] text-white border-[#d81b72]"
                          : "bg-white text-[#241814] border-[#ead8c2]"
                      } ${isBusy ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={checkout}
                  disabled={isBusy || cart.length === 0}
                  className={`w-full rounded-2xl py-4 font-bold shadow-[0_10px_25px_rgba(216,27,114,0.35)] ${
                    isBusy || cart.length === 0
                      ? "bg-[#9d8a82] text-white cursor-not-allowed"
                      : "bg-[#d81b72] text-white"
                  }`}
                >
                  {isCheckingOut ? "Processing order..." : "Checkout"}
                </button>

                {isCheckingOut && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-[#7b5b4f]">
                    <span className="h-3 w-3 rounded-full bg-[#d81b72] animate-pulse" />
                    <span className="text-sm font-bold">Saving order</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
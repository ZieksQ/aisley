"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  addCartItem,
  deleteCartItem,
  fetchCart,
  updateCartItem,
} from "@/lib/cart/client";
import type {
  AddCartItemPayload,
  CustomerCart,
  UpdateCartItemPayload,
} from "@/lib/cart/types";

type CartStatus = "idle" | "loading" | "ready" | "error";

type CartContextValue = {
  cart: CustomerCart | null;
  status: CartStatus;
  addItem: (payload: AddCartItemPayload) => Promise<CustomerCart>;
  removeItem: (itemId: string) => Promise<CustomerCart>;
  refresh: () => Promise<CustomerCart | null>;
  updateItem: (
    itemId: string,
    payload: UpdateCartItemPayload,
  ) => Promise<CustomerCart>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const customerId =
    auth.status === "authenticated" ? auth.customer.id : null;
  const [cart, setCart] = useState<CustomerCart | null>(null);
  const [status, setStatus] = useState<CartStatus>("idle");
  const [cartCustomerId, setCartCustomerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setCart(null);
      setStatus("idle");
      return null;
    }

    setStatus("loading");
    try {
      const nextCart = await fetchCart();
      setCart(nextCart);
      setCartCustomerId(customerId);
      setStatus("ready");
      return nextCart;
    } catch (error) {
      setStatus("error");
      throw error;
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      return;
    }

    const controller = new AbortController();
    fetchCart(controller.signal)
      .then((nextCart) => {
        setCart(nextCart);
        setCartCustomerId(customerId);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCartCustomerId(customerId);
        setStatus("error");
      });

    return () => controller.abort();
  }, [customerId]);

  const addItem = useCallback(
    async (payload: AddCartItemPayload) => {
      const nextCart = await addCartItem(payload);
      setCart(nextCart);
      setCartCustomerId(customerId);
      setStatus("ready");
      return nextCart;
    },
    [customerId],
  );

  const updateItem = useCallback(
    async (itemId: string, payload: UpdateCartItemPayload) => {
      const nextCart = await updateCartItem(itemId, payload);
      setCart(nextCart);
      setCartCustomerId(customerId);
      setStatus("ready");
      return nextCart;
    },
    [customerId],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const nextCart = await deleteCartItem(itemId);
      setCart(nextCart);
      setCartCustomerId(customerId);
      setStatus("ready");
      return nextCart;
    },
    [customerId],
  );

  const visibleCart =
    customerId !== null && cartCustomerId === customerId ? cart : null;
  const visibleStatus: CartStatus = !customerId
    ? "idle"
    : cartCustomerId === customerId
      ? status
      : "loading";

  const value = useMemo(
    () => ({
      cart: visibleCart,
      status: visibleStatus,
      addItem,
      removeItem,
      refresh,
      updateItem,
    }),
    [
      addItem,
      refresh,
      removeItem,
      updateItem,
      visibleCart,
      visibleStatus,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return context;
}

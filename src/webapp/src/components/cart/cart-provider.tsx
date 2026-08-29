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
import { ApiError } from "@/lib/api";
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

function isAuthenticationError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403 || error.status === 419)
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { auth, refresh: refreshAuth } = useAuth();
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
      if (isAuthenticationError(error)) {
        await refreshAuth();
      }
      setStatus("error");
      throw error;
    }
  }, [customerId, refreshAuth]);

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

        if (isAuthenticationError(error)) {
          void refreshAuth();
          return;
        }

        setCartCustomerId(customerId);
        setStatus("error");
      });

    return () => controller.abort();
  }, [customerId, refreshAuth]);

  const addItem = useCallback(
    async (payload: AddCartItemPayload) => {
      try {
        const nextCart = await addCartItem(payload);
        setCart(nextCart);
        setCartCustomerId(customerId);
        setStatus("ready");
        return nextCart;
      } catch (error) {
        if (isAuthenticationError(error)) await refreshAuth();
        throw error;
      }
    },
    [customerId, refreshAuth],
  );

  const updateItem = useCallback(
    async (itemId: string, payload: UpdateCartItemPayload) => {
      try {
        const nextCart = await updateCartItem(itemId, payload);
        setCart(nextCart);
        setCartCustomerId(customerId);
        setStatus("ready");
        return nextCart;
      } catch (error) {
        if (isAuthenticationError(error)) await refreshAuth();
        throw error;
      }
    },
    [customerId, refreshAuth],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        const nextCart = await deleteCartItem(itemId);
        setCart(nextCart);
        setCartCustomerId(customerId);
        setStatus("ready");
        return nextCart;
      } catch (error) {
        if (isAuthenticationError(error)) await refreshAuth();
        throw error;
      }
    },
    [customerId, refreshAuth],
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

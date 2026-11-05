"use client";

import { useCallback, useEffect, useRef } from "react";

/** Reject late results after this authenticated account's editor is disposed. */
export function useAccountLifetime() {
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  return useCallback(() => live.current, []);
}

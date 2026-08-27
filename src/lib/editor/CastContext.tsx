"use client";

import { createContext, useContext } from "react";

type CastContextValue = {
  castNames: string[];
  ensureCastName: (name: string) => void;
};

export const CastContext = createContext<CastContextValue>({
  castNames: [],
  ensureCastName: () => {},
});

export function useCastContext() {
  return useContext(CastContext);
}

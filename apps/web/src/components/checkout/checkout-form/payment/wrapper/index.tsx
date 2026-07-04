import type { HttpTypes } from "@medusajs/types";
import type React from "react";
import { createContext } from "react";
import { useAcceptJs } from "./accept-js";

export const AcceptJsContext = createContext(false);

export const Wrapper: React.FC<{
  cart: HttpTypes.StoreCart;
  children: React.ReactNode;
}> = ({ children }) => {
  const ready = useAcceptJs();

  return (
    <AcceptJsContext.Provider value={ready}>
      {children}
    </AcceptJsContext.Provider>
  );
};

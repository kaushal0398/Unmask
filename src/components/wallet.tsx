"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** A stand-in for a NEAR wallet, so the bid screens can be shown. It signs nothing and holds nothing. */
type Wallet = { account: string | null; connect: () => void; disconnect: () => void };
const Ctx = createContext<Wallet>({ account: null, connect: () => {}, disconnect: () => {} });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const value = useMemo(() => ({ account, connect: () => setAccount("you.near"), disconnect: () => setAccount(null) }), [account]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

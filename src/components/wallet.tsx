"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import { WalletError, networkFromEnv, signInWithWallet, type ConnectorLike } from "@/lib/wallet-core";

export type WalletMode = "real" | "demo";
type Wallet = {
  account: string | null;
  mode: WalletMode | null;
  busy: boolean;
  /** Open the NEAR wallet picker and sign in. If it cannot, the demo wallet is offered instead. */
  connect: () => Promise<void>;
  /** A made-up account, so the screens work without a wallet. It signs nothing. */
  connectDemo: () => void;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<Wallet>({ account: null, mode: null, busy: false, connect: async () => {}, connectDemo: () => {}, disconnect: async () => {} });

export const DEMO_ACCOUNT = "you.near";

/** The wallet library is large and touches the browser, so it is only loaded when someone clicks Connect. */
async function loadConnector(): Promise<ConnectorLike> {
  const { NearConnector } = await import("@hot-labs/near-connect");
  return new NearConnector({ network: networkFromEnv(process.env.NEXT_PUBLIC_NEAR_NETWORK), features: { signMessage: true } }) as unknown as ConnectorLike;
}

export function WalletProvider({ children, loader = loadConnector }: { children: ReactNode; loader?: () => Promise<ConnectorLike> }) {
  const toast = useToast();
  const [account, setAccount] = useState<string | null>(null);
  const [mode, setMode] = useState<WalletMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [connector, setConnector] = useState<ConnectorLike | null>(null);

  const connectDemo = useCallback(() => {
    setAccount(DEMO_ACCOUNT);
    setMode("demo");
    toast("Demo wallet connected. It signs nothing and holds nothing.", "info");
  }, [toast]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const c = connector ?? (await loader());
      setConnector(c);
      const r = await signInWithWallet(c);
      setAccount(r.accountId);
      setMode("real");
      toast(`Signed in as ${r.accountId}.`, "ok");
    } catch (e) {
      if (e instanceof WalletError && e.kind === "cancelled") toast(e.message, "info");
      else toast(`${e instanceof Error ? e.message : "The wallet could not be reached."} Use the demo wallet to keep looking around.`, "error");
    } finally {
      setBusy(false);
    }
  }, [connector, loader, toast]);

  const disconnect = useCallback(async () => {
    try {
      if (mode === "real") await connector?.disconnect();
    } catch {
      /* signing out of the page still works if the wallet will not answer */
    }
    setAccount(null);
    setMode(null);
  }, [connector, mode]);

  const value = useMemo(() => ({ account, mode, busy, connect, connectDemo, disconnect }), [account, mode, busy, connect, connectDemo, disconnect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

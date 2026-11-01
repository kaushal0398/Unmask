
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useToast } from "@/components/toast";
import {
  WalletError,
  networkFromEnv,
  signInWithWallet,
  type ConnectorLike,
  type SignedIn,
} from "@/lib/wallet-core";

export type WalletMode = "real" | "demo";

type Wallet = {
  account: string | null;
  mode: WalletMode | null;
  busy: boolean;
  auth: SignedIn | null;
  connect: () => Promise<void>;
  connectDemo: () => void;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<Wallet>({
  account: null,
  mode: null,
  busy: false,
  auth: null,
  connect: async () => {},
  connectDemo: () => {},
  disconnect: async () => {},
});

export const DEMO_ACCOUNT = "you.near";

async function loadConnector(): Promise<ConnectorLike> {
  const { NearConnector } = await import("@hot-labs/near-connect");

  return new NearConnector({
    network: networkFromEnv(process.env.NEXT_PUBLIC_NEAR_NETWORK),
    features: { signMessage: true },
  }) as unknown as ConnectorLike;
}

export function WalletProvider({
  children,
  loader = loadConnector,
}: {
  children: ReactNode;
  loader?: () => Promise<ConnectorLike>;
}) {
  const toast = useToast();

  const [account, setAccount] = useState<string | null>(null);
  const [mode, setMode] = useState<WalletMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [connector, setConnector] = useState<ConnectorLike | null>(null);
  const [auth, setAuth] = useState<SignedIn | null>(null);

  const connectDemo = useCallback(() => {
    setAccount(DEMO_ACCOUNT);
    setMode("demo");
    setAuth(null);

    toast("Demo wallet connected. It signs nothing and holds nothing.", "info");
  }, [toast]);

  const connect = useCallback(async () => {
    setBusy(true);

    try {
      const c = connector ?? (await loader());
      setConnector(c);

      const signed = await signInWithWallet(c);

      setAccount(signed.accountId);
      setMode("real");
      setAuth(signed);

      toast(`Signed in as ${signed.accountId}.`, "ok");
    } catch (e) {
      if (e instanceof WalletError && e.kind === "cancelled") {
        toast(e.message, "info");
      } else {
        toast(
          `${e instanceof Error ? e.message : "The wallet could not be reached."} Use the demo wallet to keep looking around.`,
          "error",
        );
      }
    } finally {
      setBusy(false);
    }
  }, [connector, loader, toast]);

  const disconnect = useCallback(async () => {
    try {
      if (mode === "real") await connector?.disconnect();
    } catch {
      // Signing out locally still works if the wallet does not answer.
    }

    setAccount(null);
    setMode(null);
    setAuth(null);
  }, [connector, mode]);

  const value = useMemo(
    () => ({ account, mode, busy, auth, connect, connectDemo, disconnect }),
    [account, mode, busy, auth, connect, connectDemo, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

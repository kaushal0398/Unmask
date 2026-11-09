
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
import type { AgentRules } from "@/lib/agent";

import {
  WalletError,
  networkFromEnv,
  signAgentRules,
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
  /** Sign agent rules with the connected wallet. Null in demo mode, where nothing can be signed. */
  signRules: (rules: AgentRules) => Promise<{ signature: string; publicKey: string } | null>;
};

const Ctx = createContext<Wallet>({
  account: null,
  mode: null,
  busy: false,
  auth: null,
  connect: async () => {},
  connectDemo: () => {},
  disconnect: async () => {},
  signRules: async () => null,
});

export const DEMO_ACCOUNT = "you.near";

async function loadConnector(): Promise<ConnectorLike> {
  const { NearConnector } = await import("@hot-labs/near-connect");

  return new NearConnector({
    network: networkFromEnv(process.env.NEXT_PUBLIC_NEAR_NETWORK),
    features: {
      signMessage: true,
    },
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

    toast(
      "Demo wallet connected. It signs nothing and holds nothing.",
      "info",
    );
  }, [toast]);

  const connect = useCallback(async () => {
    setBusy(true);

    try {
      const currentConnector = connector ?? (await loader());

      setConnector(currentConnector);

      // Performs wallet connection, backend challenge,
      // NEP-413 signing, and backend verification.
      const signed = await signInWithWallet(currentConnector);

      setAccount(signed.accountId);
      setMode("real");
      setAuth(signed);

      toast(`Signed in as ${signed.accountId}.`, "ok");
    } catch (error) {
      if (
        error instanceof WalletError &&
        error.kind === "cancelled"
      ) {
        toast(error.message, "info");
      } else {
        toast(
          `${
            error instanceof Error
              ? error.message
              : "The wallet could not be reached."
          } Use the demo wallet to keep looking around.`,
          "error",
        );
      }
    } finally {
      setBusy(false);
    }
  }, [connector, loader, toast]);

  const disconnect = useCallback(async () => {
    try {
      if (mode === "real") {
        await connector?.disconnect();
      }
    } catch {
      // Local sign-out still works if the wallet does not respond.
    }

    setAccount(null);
    setMode(null);
    setAuth(null);
  }, [connector, mode]);

  const signRules = useCallback(
    async (rules: AgentRules) => {
      if (mode !== "real" || !connector) return null;
      return signAgentRules(connector, rules);
    },
    [connector, mode],
  );

  const value = useMemo(
    () => ({
      account,
      mode,
      busy,
      auth,
      connect,
      connectDemo,
      disconnect,
      signRules,
    }),
    [account, mode, busy, auth, connect, connectDemo, disconnect, signRules],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

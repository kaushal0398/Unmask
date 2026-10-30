"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useWallet } from "@/components/wallet";

/** Connect with a NEAR wallet, or with the demo wallet. Shows the account once connected. */
export function WalletButton({ className, full }: { className?: string; full?: boolean }) {
  const { account, mode, busy, connect, connectDemo, disconnect } = useWallet();
  if (account) {
    return (
      <Button tone="ghost" onClick={() => void disconnect()} className={`font-mono text-xs ${className ?? ""}`} title={mode === "demo" ? "Disconnect the demo wallet" : "Sign out"}>
        {mode === "demo" ? `${account} (demo)` : account}
      </Button>
    );
  }
  return (
    <div className={`flex items-center gap-2 ${full ? "flex-col sm:flex-row" : ""}`}>
      <Button tone="ghost" onClick={() => void connect()} disabled={busy} className={className}>
        {busy && <Loader2 className="size-4 animate-spin" />} Connect wallet
      </Button>
      <button type="button" onClick={connectDemo} className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">use demo wallet</button>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { TokenArt } from "@/components/token-art";
import { useToast } from "@/components/toast";
import { useWallet } from "@/components/wallet";
import { getApi } from "@/lib/api";
import { Badge, Button, Card, Mono, cx } from "@/components/ui";
import type { Launch } from "@/lib/demo";
import type { ReceiptVerification } from "@/lib/api/types";
import { shortHash } from "@/lib/format";
import { runChecks, type Check as CheckResult } from "@/lib/verify-demo";

const TITLES = [
  "The code is the code we published",
  "A genuine enclave signed the result",
  "The enclave used exactly these bids",
  "Running the rule again gives the same result",
  "The money adds up",
];

export function VerifyPanel({ launches }: { launches: Launch[] }) {
  const params = useSearchParams();
  const wanted = params.get("launch");
  const { account, auth, mode } = useWallet();
  const [id, setId] = useState(
    launches.find((l) => l.id === wanted)?.id ?? launches[0]!.id,
  );
  const [tamper, setTamper] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [receiptId, setReceiptId] = useState("");
  const [receiptResult, setReceiptResult] =
    useState<ReceiptVerification | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptRunning, setReceiptRunning] = useState(false);
  const [revealRunning, setRevealRunning] = useState(false);
  const [revealCheck, setRevealCheck] = useState<{
    passed: boolean;
    computedCommitment: string;
    message: string;
  } | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const toast = useToast();
  const launch = launches.find((l) => l.id === id)!;
  const failed = results.filter((r) => r.status === "fail");
  const receiptFailed = receiptResult?.checks.filter((check) => !check.passed).length ?? 0;
  const canVerifyReceipt = mode === "real" && Boolean(account && auth?.token);

  async function verifyReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReceiptId = receiptId.trim();
    if (!normalizedReceiptId) {
      setReceiptError("Enter a receipt ID first.");
      return;
    }

    if (!canVerifyReceipt || !auth?.token) {
      setReceiptError("Connect your NEAR wallet and authenticate to verify a receipt.");
      return;
    }

    setReceiptRunning(true);
    setReceiptError(null);
    setReceiptResult(null);

    try {
      const verification = await getApi(auth.token).verifyReceipt(normalizedReceiptId);
      setReceiptResult(verification);
      setRevealCheck(null);
      setRevealError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not verify this receipt.";
      setReceiptError(message);
      toast(message, "error");
    } finally {
      setReceiptRunning(false);
    }
  }

  async function verifyRevealFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow selecting the same file again after a failed attempt.
    event.target.value = "";

    if (!file) return;

    if (!receiptResult || receiptResult.status !== "record_verified") {
      setRevealError("Verify the backend receipt successfully before checking its reveal file.");
      return;
    }

    setRevealRunning(true);
    setRevealError(null);
    setRevealCheck(null);

    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("The selected file is not a valid bid reveal JSON object.");
      }

      const reveal = parsed as Record<string, unknown>;
      const requiredStringFields = [
        "receiptId",
        "launchId",
        "bidder",
        "paymentCheckId",
        "salt",
        "commitment",
      ] as const;

      for (const field of requiredStringFields) {
        if (typeof reveal[field] !== "string" || !reveal[field]) {
          throw new Error(`The reveal file is missing a valid ${field} field.`);
        }
      }

      if (
        reveal.format !== "sealed-launchpad-bid-reveal" ||
        reveal.version !== 1
      ) {
        throw new Error("Unsupported bid reveal file format or version.");
      }

      if (
        typeof reveal.limit !== "number" ||
        !Number.isFinite(reveal.limit) ||
        reveal.limit <= 0 ||
        typeof reveal.qty !== "number" ||
        !Number.isSafeInteger(reveal.qty) ||
        reveal.qty <= 0
      ) {
        throw new Error("The reveal file contains an invalid limit price or quantity.");
      }

      if (!/^[0-9a-f]{32}$/i.test(reveal.salt as string)) {
        throw new Error("The reveal file salt is not a valid 16-byte hexadecimal value.");
      }

      const receiptMatches =
        reveal.receiptId === receiptResult.receiptId &&
        reveal.launchId === receiptResult.bid.launchId &&
        reveal.bidder === receiptResult.bid.bidder &&
        reveal.paymentCheckId === receiptResult.bid.paymentCheckId &&
        (reveal.commitment as string).toLowerCase() ===
          receiptResult.bid.commitment.toLowerCase();

      const commitmentInput = JSON.stringify([
        reveal.launchId,
        reveal.bidder,
        reveal.limit,
        reveal.qty,
        reveal.paymentCheckId,
        reveal.salt,
      ]);

      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(commitmentInput),
      );
      const computedCommitment = Array.from(
        new Uint8Array(digest),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");

      const hashMatches =
        computedCommitment.toLowerCase() ===
        (reveal.commitment as string).toLowerCase();

      const passed = receiptMatches && hashMatches;

      setRevealCheck({
        passed,
        computedCommitment,
        message: !receiptMatches
          ? "The reveal file does not match the verified backend receipt."
          : hashMatches
            ? "The SHA-256 commitment was independently recomputed and matches the backend record."
            : "The recomputed SHA-256 commitment does not match the backend record.",
      });
    } catch (error) {
      setRevealError(
        error instanceof Error
          ? error.message
          : "Could not read or verify this reveal file.",
      );
    } finally {
      setRevealRunning(false);
    }
  }

  async function run() {
    setRunning(true);
    setDone(false);
    setResults([]);
    setOpen(null);
    setFetchError(null);
    try {
      const published = await getApi().getResult(launch.id);
      if (!published)
        throw new Error("This launch has not settled yet, so there is nothing to verify.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not fetch the published result.";
      setFetchError(message);
      toast(message, "error");
      setRunning(false);
      return;
    }
    const checks = await runChecks(launch, { tamper });
    for (const c of checks) {
      await new Promise((r) => setTimeout(r, 650));
      setResults((prev) => [...prev, c]);
    }
    setRunning(false);
    setDone(true);
  }

  return (
    <div className="space-y-8">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-faint">Receipt verification</p>
            <h2 className="mt-2 text-xl font-semibold">Check your bid receipt</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Verify that a receipt belongs to your connected wallet and that its bid,
              launch, payment-check, and commitment records are consistent.
            </p>
          </div>
          <Badge tone="neutral">Backend record check</Badge>
        </div>

        <form onSubmit={verifyReceipt} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="receipt-id">Receipt ID</label>
          <input
            id="receipt-id"
            value={receiptId}
            onChange={(event) => {
              setReceiptId(event.target.value);
              setReceiptError(null);
              setReceiptResult(null);
            }}
            placeholder="Paste receipt ID (e.g. rcpt_0001)"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-none border border-line bg-bg/30 px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-faint focus:border-verified/60"
          />
          <button
            type="submit"
            disabled={receiptRunning || !receiptId.trim() || !canVerifyReceipt}
            className="inline-flex shrink-0 items-center justify-center gap-2 border border-verified bg-verified px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {receiptRunning ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {receiptRunning ? "Verifying…" : "Verify receipt"}
          </button>
        </form>

        {!canVerifyReceipt && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Connect and authenticate a real NEAR testnet wallet to verify a receipt.
            Demo mode cannot verify backend receipts.
          </p>
        )}
        {receiptError && (
          <p className="mt-4 border border-danger/50 bg-danger/5 p-3 text-sm text-danger" role="alert">
            {receiptError}
          </p>
        )}

        {receiptResult && (
          <div className="mt-5 space-y-4">
            <div className={cx(
              "flex items-start gap-3 border p-4",
              receiptResult.status === "record_verified" && receiptFailed === 0
                ? "border-verified/40 bg-verified/10"
                : "border-danger/40 bg-danger/10",
            )}>
              {receiptResult.status === "record_verified" && receiptFailed === 0
                ? <ShieldCheck className="mt-0.5 size-6 shrink-0 text-verified" />
                : <ShieldAlert className="mt-0.5 size-6 shrink-0 text-danger" />}
              <div className="min-w-0">
                <p className="font-semibold">
                  {receiptResult.status === "record_verified" && receiptFailed === 0
                    ? "Receipt record checks passed"
                    : "Receipt record checks failed"}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-muted">{receiptResult.receiptId}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  This confirms backend record consistency only. It is not proof of a valid TEE
                  attestation, an on-chain settlement, or an independently recomputed bid commitment.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-line p-3">
                <p className="text-xs text-faint">Launch</p>
                <p className="mt-1 font-medium">{receiptResult.launch.name} <span className="font-mono text-xs text-muted">${receiptResult.launch.symbol}</span></p>
              </div>
              <div className="border border-line p-3">
                <p className="text-xs text-faint">Wallet</p>
                <p className="mt-1 break-all font-mono text-xs">{receiptResult.bid.bidder}</p>
              </div>
              <div className="border border-line p-3">
                <p className="text-xs text-faint">Commitment</p>
                <p className="mt-1 break-all font-mono text-xs">{receiptResult.bid.commitment}</p>
              </div>
              <div className="border border-line p-3">
                <p className="text-xs text-faint">Payment check</p>
                <p className="mt-1 break-all font-mono text-xs">{receiptResult.paymentCheck.id}</p>
                <p className="mt-1 text-xs text-muted">{receiptResult.paymentCheck.state}</p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-wider text-faint">Verification checks</p>
              <ul className="space-y-2">
                {receiptResult.checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-3 border border-line p-3">
                    {check.passed
                      ? <Check className="mt-0.5 size-4 shrink-0 text-verified" />
                      : <X className="mt-0.5 size-4 shrink-0 text-danger" />}
                    <div>
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-line p-4">
              <p className="text-xs uppercase tracking-wider text-faint">What this does not verify</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
                {receiptResult.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            </div>
            <div className="border border-seal/30 bg-seal/5 p-4">
              <p className="text-xs uppercase tracking-wider text-faint">
                Independent commitment verification
              </p>
              <h3 className="mt-2 text-sm font-semibold">
                Verify your private bid reveal file
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Select the JSON file downloaded when you submitted this bid.
                It is read and hashed locally in your browser; the file and its
                salt are not uploaded to the backend.
              </p>
              <label className="mt-4 block">
                <span className="sr-only">Bid reveal JSON file</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => void verifyRevealFile(event)}
                  disabled={revealRunning || receiptResult.status !== "record_verified"}
                  className="block w-full text-xs text-muted file:mr-3 file:border file:border-line-strong file:bg-bg file:px-3 file:py-2 file:text-xs file:text-text hover:file:bg-white/5 disabled:opacity-50"
                />
              </label>
              {revealRunning && (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted" aria-live="polite">
                  <Loader2 className="size-3.5 animate-spin" />
                  Recomputing SHA-256 commitment locally…
                </p>
              )}
              {revealError && (
                <p className="mt-3 border border-danger/50 bg-danger/5 p-3 text-xs text-danger" role="alert">
                  {revealError}
                </p>
              )}
              {revealCheck && (
                <div className={cx(
                  "mt-3 border p-3",
                  revealCheck.passed
                    ? "border-verified/40 bg-verified/10"
                    : "border-danger/40 bg-danger/10",
                )}>
                  <p className={cx(
                    "text-sm font-semibold",
                    revealCheck.passed ? "text-verified" : "text-danger",
                  )}>
                    {revealCheck.passed
                      ? "Commitment independently verified"
                      : "Commitment verification failed"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {revealCheck.message}
                  </p>
                  <p className="mt-3 text-xs text-faint">Computed SHA-256</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-text">
                    {revealCheck.computedCommitment}
                  </p>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                Only verify a reveal after bidding has closed and disclosure is
                safe. Anyone who obtains the reveal file can see the bid values.
              </p>
            </div>

            <p className="text-xs text-faint">
              Verification level: <Mono>{receiptResult.verificationLevel}</Mono>
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wider text-faint">Which launch</p>
            <ul className="mt-3 space-y-2">
              {launches.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => { setId(l.id); setResults([]); setDone(false); }}
                    className={cx("flex w-full items-center gap-3 rounded-none border p-3 text-left transition-colors", id === l.id ? "border-verified/50 bg-verified/5" : "border-line hover:bg-white/5")}
                    aria-pressed={id === l.id}
                  >
                    <TokenArt hue={l.hue} emoji={l.emoji} symbol={l.symbol} size={38} />
                    <span>
                      <span className="block text-sm font-medium">{l.name}</span>
                      <span className="block font-mono text-xs text-muted">${l.symbol}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className={cx("p-5 transition-colors", tamper && "border-danger/40")}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-[#ff5c5c]" checked={tamper} onChange={(e) => { setTamper(e.target.checked); setResults([]); setDone(false); }} />
              <span>
                <span className="block text-sm font-medium">Pretend someone cheated</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">Publishes a result that moves 50,000 tokens to a bot. Watch the checks catch it.</span>
              </span>
            </label>
          </Card>
          <Button tone="primary" className="w-full py-3.5 text-base" onClick={run} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {running ? "Checking…" : done ? "Check again" : "Run the checks"}
          </Button>
          {fetchError && <p className="mt-3 border border-danger/50 bg-danger/5 p-3 text-sm text-danger" role="alert">{fetchError} Press the button to try again.</p>}
          <dl className="space-y-2 rounded-none border border-line p-4 text-xs text-muted">
            <div className="flex justify-between gap-3"><dt>Code hash</dt><dd><Mono>{shortHash(launch.codeHash)}</Mono></dd></div>
            <div className="flex justify-between gap-3"><dt>Input hash</dt><dd><Mono>{launch.inputHash ? shortHash(launch.inputHash) : "—"}</Mono></dd></div>
            <div className="flex justify-between gap-3"><dt>Token</dt><dd><Mono>{launch.tokenContract}</Mono></dd></div>
          </dl>
        </div>

        <div>
          <AnimatePresence>
            {done && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cx("mb-5 flex items-start gap-4 rounded-none border p-5", failed.length ? "border-danger/40 bg-danger/10" : "border-verified/40 bg-verified/10")}>
                {failed.length ? <ShieldAlert className="mt-0.5 size-7 shrink-0 text-danger" /> : <ShieldCheck className="mt-0.5 size-7 shrink-0 text-verified" />}
                <div>
                  <p className={cx("text-lg font-semibold", failed.length ? "text-danger" : "text-verified")}>{failed.length ? "Do not trust this result" : "This launch was run fairly"}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {failed.length ? `${failed.length} of ${results.length} checks failed. The published result does not match what the rules give for these bids.` : `All ${results.length} checks passed for ${launch.name}. Nobody had to be trusted: every step was recomputed here.`}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ol className="space-y-3">
            {TITLES.map((title, i) => {
              const r = results[i];
              const active = running && results.length === i;
              return (
                <li key={title}>
                  <Card className={cx("overflow-hidden transition-colors", r?.status === "pass" && "border-verified/25", r?.status === "fail" && "border-danger/50")}>
                    <button className="flex w-full items-center gap-4 p-5 text-left" onClick={() => r && setOpen(open === r.id ? null : r.id)} disabled={!r} aria-expanded={r ? open === r.id : false}>
                      <span className={cx("grid size-9 shrink-0 place-items-center rounded-none border", r?.status === "pass" && "border-verified bg-verified text-black", r?.status === "fail" && "border-danger bg-danger text-black", !r && "border-line-strong text-faint")}>
                        {r?.status === "pass" ? <Check className="size-5" strokeWidth={3} /> : r?.status === "fail" ? <X className="size-5" strokeWidth={3} /> : active ? <Loader2 className="size-4 animate-spin" /> : <span className="font-mono text-sm">{i + 1}</span>}
                      </span>
                      <span className="flex-1">
                        <span className={cx("block font-medium", !r && !active && "text-muted")}>{title}</span>
                        <span className="mt-0.5 block text-sm text-muted">{r ? r.plain : active ? "Checking…" : "Waiting"}</span>
                      </span>
                      {r && <ChevronDown className={cx("size-5 text-faint transition-transform", open === r.id && "rotate-180")} />}
                    </button>
                    <AnimatePresence initial={false}>
                      {r && open === r.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-line px-5 pb-5 pt-4">
                            <p className={cx("text-sm leading-relaxed", r.status === "fail" ? "text-danger" : "text-muted")}>{r.detail}</p>
                            <dl className="mt-4 space-y-2 rounded-none bg-bg/50 p-4 text-xs">
                              {r.evidence.map(([k, v]) => (
                                <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-6">
                                  <dt className="text-faint">{k}</dt>
                                  <dd className="break-all font-mono text-text sm:text-right">{v}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </li>
              );
            })}
          </ol>
          {!done && !running && results.length === 0 && <p className="mt-5 text-sm text-faint">Pick a launch and run the checks. Each one can be opened to see the numbers behind it.</p>}
          <div className="mt-6"><Badge tone="neutral">Demo: hashing and re-running the auction are real; the attestation needs the enclave</Badge></div>
        </div>
      </div>
    </div>
  );
}

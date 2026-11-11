"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Loader2, Minus, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Mono, cx } from "@/components/ui";
import { getApi } from "@/lib/api";
import { shortHash } from "@/lib/format";
import { verdictOf, verifyBackendResult, type RawLaunch, type RawResult, type VerifyCheck } from "@/lib/verify-result";

type Load = { id: string; kind: "ready" | "none" | "error"; data?: { launch: RawLaunch; result: RawResult }; message?: string };

/**
 * Verify a real settled launch. Every check is recomputed here, in the browser, from the public result. A check that
 * cannot be done from here is shown as "Not checked" and never counts as a pass.
 */
export function VerifyBackendLaunch({ id }: { id: string }) {
  const [load, setLoad] = useState<Load | null>(null);
  const [checks, setChecks] = useState<VerifyCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getApi()
      .getVerification(id)
      .then((data) => live && setLoad(data ? { id, kind: "ready", data } : { id, kind: "none" }))
      .catch((e) => live && setLoad({ id, kind: "error", message: e instanceof Error ? e.message : "Could not load the result." }));
    return () => { live = false; };
  }, [id]);

  const state = load?.id === id ? load : null;

  async function run() {
    if (state?.kind !== "ready" || !state.data) return;
    setRunning(true); setDone(false); setChecks([]); setOpen(null);
    const all = await verifyBackendResult(state.data.launch, state.data.result);
    for (const c of all) {
      await new Promise((r) => setTimeout(r, 350));
      setChecks((prev) => [...prev, c]);
    }
    setRunning(false); setDone(true);
  }

  if (!state) return <p className="flex items-center gap-2 py-10 text-muted"><Loader2 className="size-4 animate-spin" /> Loading the result…</p>;
  if (state.kind === "error") return <p className="border border-danger/50 bg-danger/5 p-4 text-sm text-danger" role="alert">{state.message}</p>;
  if (state.kind === "none") return <p className="border border-line p-4 text-sm text-muted">This launch has no published result yet, so there is nothing to verify. A launch can only be verified once it has been settled.</p>;

  const r = state.data!.result;
  const verdict = done ? verdictOf(checks) : null;
  const TONE = { pass: "border-verified/25", fail: "border-danger/50", unchecked: "border-price/40" } as const;

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]" data-testid="verify-launch">
      <div className="space-y-5">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-faint">Launch</p>
          <p className="mt-2 break-all font-mono text-sm">{id}</p>
          <p className="mt-2 text-xs text-muted">Settled by: <span className="text-text">{r.mode === "dev" ? "the development enclave" : r.mode === "outlayer" ? "OutLayer (attestation not verified by us)" : "an attested enclave"}</span></p>
        </Card>
        <Button tone="primary" className="w-full py-3.5 text-base" onClick={run} disabled={running}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {running ? "Checking…" : done ? "Check again" : "Run the checks"}
        </Button>
        <dl className="space-y-2 rounded-none border border-line p-4 text-xs text-muted">
          <div className="flex justify-between gap-3"><dt>Code hash</dt><dd><Mono>{shortHash(r.codeHash)}</Mono></dd></div>
          <div className="flex justify-between gap-3"><dt>Input hash</dt><dd><Mono>{shortHash(r.inputHash)}</Mono></dd></div>
          <div className="flex justify-between gap-3"><dt>Output hash</dt><dd><Mono>{shortHash(r.outcome.engineOutputHash ?? "—")}</Mono></dd></div>
          <div className="flex justify-between gap-3"><dt>Counted bids</dt><dd><Mono>{r.outcome.fills.length}</Mono></dd></div>
        </dl>
      </div>

      <div>
        <AnimatePresence>
          {verdict && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="verify-verdict" data-kind={verdict.kind}
              className={cx("mb-5 flex items-start gap-4 border p-5", verdict.kind === "fail" ? "border-danger/40 bg-danger/10" : verdict.kind === "partial" ? "border-price/40 bg-price/10" : "border-verified/40 bg-verified/10")}>
              {verdict.kind === "fail" ? <ShieldAlert className="mt-0.5 size-7 shrink-0 text-danger" /> : <ShieldCheck className={cx("mt-0.5 size-7 shrink-0", verdict.kind === "partial" ? "text-price" : "text-verified")} />}
              <div>
                <p className={cx("text-lg font-semibold", verdict.kind === "fail" ? "text-danger" : verdict.kind === "partial" ? "text-price" : "text-verified")}>{verdict.headline}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{verdict.text}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ol className="space-y-3">
          {checks.length === 0 && !running && <li className="text-sm text-faint">Run the checks. Each one can be opened to see the numbers behind it, and any that cannot be checked from here say so.</li>}
          {checks.map((c) => (
            <li key={c.id} data-testid="verify-check" data-status={c.status} data-id={c.id}>
              <Card className={cx("overflow-hidden transition-colors", TONE[c.status])}>
                <button className="flex w-full items-center gap-4 p-5 text-left" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                  <span className={cx("grid size-9 shrink-0 place-items-center border", c.status === "pass" && "border-verified bg-verified text-black", c.status === "fail" && "border-danger bg-danger text-black", c.status === "unchecked" && "border-price text-price")}>
                    {c.status === "pass" ? <Check className="size-5" strokeWidth={3} /> : c.status === "fail" ? <X className="size-5" strokeWidth={3} /> : <Minus className="size-5" strokeWidth={3} />}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{c.title}{c.status === "unchecked" && <span className="ml-2 text-xs font-normal uppercase tracking-wider text-price">not checked</span>}</span>
                    <span className="mt-0.5 block text-sm text-muted">{c.plain}</span>
                  </span>
                  <ChevronDown className={cx("size-5 text-faint transition-transform", open === c.id && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {open === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border-t border-line px-5 pb-5 pt-4">
                        <p className={cx("text-sm leading-relaxed", c.status === "fail" ? "text-danger" : "text-muted")}>{c.detail}</p>
                        <dl className="mt-4 space-y-2 bg-bg/50 p-4 text-xs">
                          {c.evidence.map(([k, v]) => (
                            <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-6"><dt className="text-faint">{k}</dt><dd className="break-all font-mono text-text sm:text-right">{v}</dd></div>
                          ))}
                        </dl>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { TokenArt } from "@/components/token-art";
import { Badge, Button, Card, Mono, cx } from "@/components/ui";
import type { Launch } from "@/lib/demo";
import { shortHash } from "@/lib/format";
import { runChecks, type Check as CheckResult } from "@/lib/verify-demo";

const TITLES = ["The code is the code we published", "A genuine enclave signed the result", "The enclave used exactly these bids", "Running the rule again gives the same result", "The money adds up"];

export function VerifyPanel({ launches }: { launches: Launch[] }) {
  const params = useSearchParams();
  const wanted = params.get("launch");
  const [id, setId] = useState(launches.find((l) => l.id === wanted)?.id ?? launches[0]!.id);
  const [tamper, setTamper] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const launch = launches.find((l) => l.id === id)!;

  async function run() {
    setRunning(true);
    setDone(false);
    setResults([]);
    setOpen(null);
    const checks = await runChecks(launch, { tamper });
    for (const c of checks) {
      await new Promise((r) => setTimeout(r, 650));
      setResults((prev) => [...prev, c]);
    }
    setRunning(false);
    setDone(true);
  }

  const failed = results.filter((r) => r.status === "fail");

  return (
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
                          <dl className="mt-4 space-y-2 rounded-none bg-black/50 p-4 text-xs">
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
  );
}

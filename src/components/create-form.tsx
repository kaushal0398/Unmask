"use client";

import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { TokenArt } from "@/components/token-art";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";
import { getApi } from "@/lib/api";
import { CreateStepError, type CreateStep, type CreateStepId } from "@/lib/api/types";
import { Badge, ButtonLink, Button, Card, Mono, cx } from "@/components/ui";
import { compact, tokens, usd } from "@/lib/format";
import { useWallet } from "@/components/wallet";

const WINDOWS = [
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "360", label: "6 hours" },
  { value: "1440", label: "24 hours" },
];
const CAPS = [
  { value: "0", label: "No cap" },
  { value: "1", label: "1% of supply" },
  { value: "5", label: "5% of supply" },
  { value: "10", label: "10% of supply" },
];

const hueOf = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <span className="mt-1.5 block text-xs text-danger" role="alert">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

const inputClass = "w-full rounded-none border border-line-strong bg-bg px-4 py-3 text-base outline-none placeholder:text-faint focus:bg-white/[0.03]";

export function CreateForm() {
  const { auth, mode } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000");
  const [reserve, setReserve] = useState("0.01");
  const [windowMin, setWindowMin] = useState("60");
  const [cap, setCap] = useState("5");
  const [unsold, setUnsold] = useState<"return" | "burn">("return");
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState<{ id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState<CreateStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const supplyN = Number(supply.replaceAll(",", ""));
  const reserveN = Number(reserve);
  const errors = {
    name: name.trim().length < 2 || name.trim().length > 24 ? "Between 2 and 24 characters." : "",
    symbol: !/^[A-Z0-9]{2,8}$/.test(symbol) ? "2 to 8 capital letters or digits." : "",
    supply: !(Number.isInteger(supplyN) && supplyN >= 1_000 && supplyN <= 1e12) ? "A whole number from 1,000 to 1 trillion." : "",
    reserve: !(reserveN > 0 && reserveN < 1000) ? "More than zero." : "",
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : "");
  const minRaise = valid ? supplyN * reserveN : 0;

  async function run(resumeFrom?: CreateStepId) {
  setRunning(true);

  try {
    if (mode !== "real" || !auth?.token) {
      throw new Error(
        "Connect your real NEAR wallet before creating a launch.",
      );
    }

    const { id } = await getApi(auth.token).createLaunch(
      {
        name: name.trim(),
        symbol,
        supply: supplyN,
        reserve: reserveN,
        windowMinutes: Number(windowMin),
        capPercent: Number(cap),
        unsold,
      },
      setSteps,
      { resumeFrom },
    );

    setCreated({ id });
    setSteps(null);
    toast(`${name.trim()} is ready to open.`, "ok");
  } catch (e) {
    if (!(e instanceof CreateStepError)) {
      toast(
        e instanceof Error ? e.message : "Could not create the launch.",
        "error",
      );
      setSteps(null);
    } else {
      toast(e.message, "error");
    }
  } finally {
    setRunning(false);
  }
}

  async function start() {
    setTouched(true);
    if (!valid) return;
    const ok = await confirm({
      title: `Create ${name.trim()}?`,
      body: <p>This sets the rules for good: {tokens(supplyN)} tokens, reserve {usd(reserveN)}, a {WINDOWS.find((w) => w.value === windowMin)?.label} window. Nobody, you included, can change them once bidding opens.</p>,
      confirm: "Create launch",
      tone: "seal",
    });
    if (ok) await run();
  }

  const failedStep = steps?.find((x) => x.state === "failed");
  if (steps && !created) {
    return (
      <Card className="mx-auto max-w-xl p-8" aria-busy={running}>
        <h2 className="text-xl font-semibold tracking-tight">Creating {name.trim()}</h2>
        <p className="mt-2 text-sm text-muted">Each step is done once. If one fails, you continue from it and nothing before it is repeated.</p>
        <ol className="mt-6 space-y-3">
          {steps.map((st) => (
            <li key={st.id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5">
                {st.state === "done" ? <Check className="size-4 text-verified" /> : st.state === "running" ? <Loader2 className="size-4 animate-spin text-seal-fg" /> : st.state === "failed" ? <AlertTriangle className="size-4 text-danger" /> : <span className="block size-4 border border-line-strong" />}
              </span>
              <span className={st.state === "pending" ? "text-faint" : "text-text"}>
                {st.label}
                {st.error && <span className="mt-1 block text-xs text-danger" role="alert">{st.error}</span>}
              </span>
            </li>
          ))}
        </ol>
        {failedStep && !running && (
          <div className="mt-6 flex gap-3">
            <Button tone="seal" onClick={() => void run(failedStep.id)}>Retry from this step</Button>
            <Button tone="ghost" onClick={() => setSteps(null)}>Back to the form</Button>
          </div>
        )}
      </Card>
    );
  }

  if (created) {
    const link = `https://sealed.example/launches/${created.id}`;
    return (
      <Card className="mx-auto max-w-xl border-verified/30 p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-none bg-verified text-black"><Check className="size-7" /></span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">{name.trim()} is ready to open</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Share the link, and bids stay sealed until the close.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-none border border-line-strong bg-bg p-2 pl-4 text-left">
          <Mono className="flex-1 truncate text-sm text-muted">{link}</Mono>
          <Button tone="ghost" className="px-3 py-2" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/launches/moonbean" tone="seal">See how a live launch looks</ButtonLink>
          <Button tone="ghost" onClick={() => { setCreated(null); setTouched(false); }}>Create another</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-[1.6fr_1fr]">
          <Field label="Token name" error={show("name")}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="MoonBean" maxLength={24} autoComplete="off" />
          </Field>
          <Field label="Symbol" error={show("symbol")}>
            <input className={cx(inputClass, "font-mono uppercase")} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BEAN" maxLength={8} autoComplete="off" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tokens for sale" hint="The whole supply of this auction." error={show("supply")}>
            <input className={cx(inputClass, "font-mono")} inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value)} />
          </Field>
          <Field label="Reserve price per token" hint="Bids under this are not in the auction." error={show("reserve")}>
            <div className="flex items-center rounded-none border border-line-strong bg-bg px-4 focus-within:bg-white/[0.03]">
              <span className="text-muted">$</span>
              <input className="w-full bg-transparent px-2 py-3 font-mono text-base outline-none" inputMode="decimal" value={reserve} onChange={(e) => setReserve(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Bidding window" hint="How long bids are accepted.">
            <select className={inputClass} value={windowMin} onChange={(e) => setWindowMin(e.target.value)}>
              {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>
          <Field label="Cap per account" hint="Makes one wallet less decisive. It cannot stop many wallets.">
            <select className={inputClass} value={cap} onChange={(e) => setCap(e.target.value)}>
              {CAPS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">If the supply does not sell out</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {([["return", "Return unsold tokens to me"], ["burn", "Burn them"]] as const).map(([v, label]) => (
              <label key={v} className={cx("flex cursor-pointer items-center gap-3 rounded-none border p-4 text-sm transition-colors", unsold === v ? "border-seal bg-seal/5" : "border-line-strong hover:bg-white/5")}>
                <input type="radio" name="unsold" className="accent-[#e501a5]" checked={unsold === v} onChange={() => setUnsold(v)} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Decided now, so no one can change the rule after seeing the bids.</p>
        </fieldset>
        <Button type="submit" tone="seal" className="w-full py-3.5 text-base sm:w-auto sm:px-10">
          Create launch
        </Button>
      </form>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-xs uppercase tracking-wider text-faint">Preview</p>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <TokenArt hue={hueOf(name + symbol)} symbol={symbol || name || "?"} size={64} />
            <div>
              <p className="text-xl font-semibold tracking-tight">{name.trim() || "Your token"}</p>
              <p className="font-mono text-sm text-muted">${symbol || "SYMBOL"}</p>
            </div>
          </div>
          <div className="mt-5"><Badge tone="seal"><span className="size-1.5 rounded-none bg-seal" /> Bids open for {WINDOWS.find((w) => w.value === windowMin)?.label}</Badge></div>
          <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">For sale</dt><dd><Mono>{valid ? compact(supplyN) : "—"}</Mono></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Reserve</dt><dd><Mono>{reserveN > 0 ? usd(reserveN) : "—"}</Mono></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Raises at least</dt><dd><Mono>{valid ? usd(minRaise, { compact: true }) : "—"}</Mono></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Most per account</dt><dd><Mono>{cap === "0" || !valid ? "no cap" : tokens(supplyN * Number(cap) / 100)}</Mono></dd></div>
          </dl>
        </Card>
        <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted">
          <li>Every winner pays one price, found at the close. It can be above the reserve if demand is high.</li>
          <li>You receive the proceeds after settlement. Unsold tokens follow the rule you pick.</li>
        </ul>
      </aside>
    </div>
  );
}

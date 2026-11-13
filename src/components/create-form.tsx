"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TokenArt } from "@/components/token-art";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";
import { getApi } from "@/lib/api";
import { saveTokenImage } from "@/lib/token-image";
import { CreateStepError, type CreateStep, type CreateStepId } from "@/lib/api/types";
import { Badge, Button, Card, Mono, cx } from "@/components/ui";
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

/** Crops to a square and shrinks to 256px so the stored picture stays small (a few tens of KB). */
async function shrinkImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Choose a PNG, JPEG, WebP or GIF image.");
  if (file.size > 8_000_000) throw new Error("That image is too large (8 MB max).");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  for (const q of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL("image/webp", q);
    if (url.startsWith("data:image/webp") && url.length < 110_000) return url;
    const jpg = canvas.toDataURL("image/jpeg", q);
    if (jpg.length < 110_000) return jpg;
  }
  throw new Error("Could not shrink that image enough. Try a simpler one.");
}

const inputClass = "w-full rounded-none border border-line-strong bg-bg px-4 py-3 text-base outline-none placeholder:text-faint focus:bg-white/[0.03]";

export function CreateForm() {
  const { auth, mode } = useWallet();
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000");
  const [reserve, setReserve] = useState("0.01");
  const [windowMin, setWindowMin] = useState("60");
  const [cap, setCap] = useState("5");
  const [image, setImage] = useState<string | undefined>();
  const [imageError, setImageError] = useState("");
  const [unsold, setUnsold] = useState<"return" | "burn">("return");
  const [touched, setTouched] = useState(false);
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

    // The picture stays in this browser only; it is not sent to the backend.
    if (image) saveTokenImage(id, image);
    // Go straight to the new launch's own page on this site.
    toast(`${name.trim()} is live.`, "ok");
    router.push(`/launches/${encodeURIComponent(id)}`);
    return;
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
  if (steps) {
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
        <div>
          <span className="text-sm text-muted">Token image <span className="text-faint">(optional)</span></span>
          <div className="mt-2 flex items-center gap-4">
            <TokenArt hue={hueOf(name + symbol)} image={image} symbol={symbol || name || "?"} size={64} />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center border border-line-strong px-4 py-2.5 text-sm hover:bg-white/5">
                Choose from gallery
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setImageError("");
                    try { setImage(await shrinkImage(f)); } catch (err) { setImageError(err instanceof Error ? err.message : "Could not use that image."); }
                  }}
                />
              </label>
              {image && <button type="button" onClick={() => setImage(undefined)} className="text-xs text-muted underline underline-offset-4 hover:text-text">Remove</button>}
            </div>
          </div>
          {imageError && <p className="mt-1.5 text-xs text-danger" role="alert">{imageError}</p>}
          <p className="mt-1.5 text-xs text-faint">Optional. Saved in this browser only, so it shows on this device.</p>
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
            <TokenArt hue={hueOf(name + symbol)} image={image} symbol={symbol || name || "?"} size={64} />
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

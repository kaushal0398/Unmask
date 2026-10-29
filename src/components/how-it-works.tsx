import { ClearStepArt, SealStepArt, VerifyStepArt, WaitStepArt } from "@/components/art";
import { Card } from "@/components/ui";

const steps = [
  { Art: SealStepArt, tone: "seal", title: "Seal", text: "Choose the most you'd pay per token and how many you want. Your bid is encrypted so only the enclave can read it, and the most you could owe is locked in a payment check." },
  { Art: WaitStepArt, tone: "seal", title: "Wait for the close", text: "The page shows a countdown and how many bids there are. Never an amount. Arriving first gives no edge, and no one can read the order book." },
  { Art: ClearStepArt, tone: "verified", title: "Clear", text: "At the deadline the enclave finds the single price that sells the supply. Everyone who wins pays that price, not their own limit. Everyone else gets everything back." },
  { Art: VerifyStepArt, tone: "verified", title: "Verify", text: "The code hash, the attestation, the result and the transfers are published. Anyone can recompute them and see that the auction ran as promised." },
] as const;

export function HowItWorks() {
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title}>
          <Card className="group h-full p-0 transition-colors hover:bg-raised">
            <div className={`border-b border-line p-5 ${s.tone === "seal" ? "text-seal" : "text-verified"}`}>
              <div className="flex items-center justify-between text-faint">
                <span className="font-mono text-xs">STEP 0{i + 1}</span>
                <span className="size-1.5 bg-current opacity-60" />
              </div>
              <div className="mt-4 text-text">
                <s.Art />
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}

import { ArrowRight } from "lucide-react";
import { ClearStepArt, SealStepArt, VerifyStepArt, WaitStepArt } from "@/components/art";

type Step = {
  Art: (props: { className?: string }) => React.ReactNode;
  title: string;
  text: string;
  tag: string;
  /** Flat accent colour for the step: border, number, tag. */
  color: string;
  bar: string;
  border: string;
};

const steps: Step[] = [
  { Art: SealStepArt, title: "Seal", tag: "you see: your bid · they see: nothing", color: "text-seal", bar: "bg-seal", border: "border-seal/50", text: "Choose the most you'd pay per token and how many you want. Your bid is encrypted so only the enclave can read it, and the most you could owe is locked in a payment check." },
  { Art: WaitStepArt, title: "Wait for the close", tag: "public: a count · hidden: every amount", color: "text-price", bar: "bg-price", border: "border-price/50", text: "The page shows a countdown and how many bids there are. Never an amount. Arriving first gives no edge, and no one can read the order book." },
  { Art: ClearStepArt, title: "Clear", tag: "one price · everyone pays it", color: "text-near", bar: "bg-near", border: "border-near/50", text: "At the deadline the enclave finds the single price that sells the supply. Everyone who wins pays that price, not their own limit. Everyone else gets everything back." },
  { Art: VerifyStepArt, title: "Verify", tag: "everything public · anyone can re-run it", color: "text-verified", bar: "bg-verified", border: "border-verified/50", text: "The code hash, the attestation, the result and the transfers are published. Anyone can recompute them and see that the auction ran as promised." },
];

export function HowItWorks() {
  return (
    <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="relative">
          <div className={`group flex h-full flex-col overflow-hidden border-2 bg-surface transition-transform duration-200 hover:-translate-y-1 ${s.border}`}>
            <div className={`h-1.5 ${s.bar}`} />
            <div className="flex items-start justify-between p-5 pb-0">
              <span className={`font-mono text-6xl font-bold leading-none tracking-tighter ${s.color}`}>0{i + 1}</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">step</span>
            </div>
            <div className={`mx-5 mt-4 border border-line bg-bg p-4 ${s.color}`}>
              <div className="text-text">
                <s.Art />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.text}</p>
              <p className={`mt-5 border-t border-line pt-3 font-mono text-[11px] uppercase tracking-wider ${s.color}`}>{s.tag}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute -right-4 top-1/2 z-10 hidden size-7 -translate-y-1/2 place-items-center border border-line-strong bg-bg text-muted lg:grid">
              <ArrowRight className="size-4" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

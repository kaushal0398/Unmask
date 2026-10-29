"use client";

import { useState } from "react";
import { LaunchCard } from "@/components/launch-card";
import { cx } from "@/components/ui";
import type { Launch, LaunchStatus } from "@/lib/demo";

const tabs: Array<{ key: "all" | LaunchStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Bids open" },
  { key: "sealed", label: "Settling" },
  { key: "settled", label: "Settled" },
];

export function LaunchGrid({ launches }: { launches: Launch[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");
  const shown = launches.filter((l) => tab === "all" || l.status === tab);
  const count = (k: (typeof tabs)[number]["key"]) => launches.filter((l) => k === "all" || l.status === k).length;

  return (
    <div>
      <div role="tablist" aria-label="Filter launches" className="inline-flex flex-wrap border border-line-strong bg-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_16px_32px_-20px_rgb(0_0_0/0.9)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx("border-r border-line px-5 py-3 text-sm transition-colors last:border-r-0", tab === t.key ? "bg-text text-bg" : "text-muted hover:bg-white/5 hover:text-text")}
          >
            {t.label} <span className={cx("ml-1 font-mono text-xs", tab === t.key ? "text-bg/60" : "text-faint")}>{count(t.key)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-10 rounded-none border border-dashed border-line-strong p-10 text-center text-sm text-muted">Nothing here yet.</p>
      ) : (
        <ul className="mt-8 grid gap-x-7 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((l, i) => (
            <li key={l.id}>
              <LaunchCard launch={l} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

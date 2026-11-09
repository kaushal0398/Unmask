import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** A black card with the name big and a pink "sealed" bar, shared by the site and every launch. */
export function ogImage(opts: { eyebrow: string; title: string; sub: string; hue?: number }) {
  const accent = opts.hue === undefined ? "#e501a5" : `hsl(${opts.hue} 85% 60%)`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#000", color: "#fff", padding: 72, borderLeft: `24px solid ${accent}` }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: accent }}>{opts.eyebrow.toUpperCase()}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 700, lineHeight: 1.05 }}>{opts.title}</div>
          <div style={{ display: "flex", fontSize: 38, color: "#a1a1aa", marginTop: 24 }}>{opts.sub}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>Unmask · bots lose their edge · built on NEAR</div>
      </div>
    ),
    OG_SIZE,
  );
}

import { getLaunch } from "@/lib/demo";
import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A sealed launch";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const l = getLaunch((await params).id);
  if (!l) return ogImage({ eyebrow: "Unmask", title: "Launch", sub: "Bid in secret, pay one price." });
  return ogImage({ eyebrow: l.status === "settled" ? "Settled launch" : "Sealed bids", title: `${l.name} $${l.symbol}`, sub: `Sealed-bid launch by ${l.creator}`, hue: l.hue });
}

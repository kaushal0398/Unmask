import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sealed: snipe-proof token launches";

export default function Image() {
  return ogImage({ eyebrow: "Snipe-proof token launches", title: "Sealed", sub: "Everyone bids in secret. Everyone pays the same price." });
}

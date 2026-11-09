import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Unmask: the token launch where bots lose their edge";

export default function Image() {
  return ogImage({ eyebrow: "The token launch where bots lose their edge", title: "Unmask", sub: "Bid blind, win fair, check everything." });
}

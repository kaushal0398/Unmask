import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { DemoPanel } from "@/components/demo-panel";
import { ConfirmProvider } from "@/components/confirm";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { WalletProvider } from "@/components/wallet";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Sealed — snipe-proof token launches", template: "%s · Sealed" },
  description:
    "A token launch where everyone bids in secret, everyone pays the same price, and anyone can check afterwards that the auction was run fairly.",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-text">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:text-black">Skip to content</a>
        <ToastProvider>
          <ConfirmProvider>
            <WalletProvider>
              <Nav />
              <main id="main" className="flex-1">{children}</main>
              <Footer />
              <DemoPanel />
            </WalletProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

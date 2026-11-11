import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import { DemoPanel } from "@/components/demo-panel";
import { ConfirmProvider } from "@/components/confirm";
import { Footer } from "@/components/footer";
import { Logo, Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { WalletProvider } from "@/components/wallet";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Unmask — the token launch where bots lose their edge", template: "%s · Unmask" },
  description:
    "The token launch where bots lose their edge. Bid blind, win fair, check everything.",
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
              {/* The nav reads the current path, which is unknown while a dynamic route is prerendered. */}
              <Suspense
                fallback={
                  <header className="sticky top-0 z-40 border-b border-line bg-bg/80">
                    <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
                      <Logo />
                    </div>
                  </header>
                }
              >
                <Nav />
              </Suspense>
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

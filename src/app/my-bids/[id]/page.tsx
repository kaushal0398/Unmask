import { Suspense } from "react";
import { BidReceiptView } from "./receipt-view";

// The receipt reads the route parameter and the wallet in the browser, so it streams in behind a Suspense boundary.
export default function BidReceiptPage() {
  return (
    <Suspense fallback={<p aria-busy className="py-16 text-center text-muted">Loading your receipt…</p>}>
      <BidReceiptView />
    </Suspense>
  );
}

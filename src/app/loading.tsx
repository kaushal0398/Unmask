import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-14 sm:py-20">
      <div aria-busy="true" aria-label="Loading" className="space-y-6">
        <div className="h-5 w-24 shimmer" />
        <div className="h-12 w-full max-w-xl shimmer" />
        <div className="h-72 shimmer" />
      </div>
    </Container>
  );
}

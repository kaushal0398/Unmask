import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="grid min-h-[60vh] place-items-center py-24 text-center">
      <div>
        <p className="font-mono text-6xl text-seal">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">That envelope is empty.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">There is no page here. The launches are this way.</p>
        <ButtonLink href="/launches" tone="seal" className="mt-8">See launches</ButtonLink>
      </div>
    </Container>
  );
}

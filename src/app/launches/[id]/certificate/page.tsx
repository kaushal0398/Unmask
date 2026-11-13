import { Container } from "@/components/ui";
import { CertificateView } from "@/components/certificate-view";

export default async function Page({ params }: PageProps<"/launches/[id]/certificate">) {
  return (
    <Container className="py-12 sm:py-16">
      <CertificateView id={(await params).id} />
    </Container>
  );
}

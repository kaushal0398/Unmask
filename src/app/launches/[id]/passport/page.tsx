import { Container } from "@/components/ui";
import { PassportView } from "@/components/passport-view";

export default async function Page({ params }: PageProps<"/launches/[id]/passport">) {
  return (
    <Container className="py-12 sm:py-16">
      <PassportView id={(await params).id} />
    </Container>
  );
}

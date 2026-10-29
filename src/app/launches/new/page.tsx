import type { Metadata } from "next";
import { CreateForm } from "@/components/create-form";
import { Container, DemoNote, Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Create a launch" };

export default function NewLaunchPage() {
  return (
    <Container className="py-14 sm:py-20">
      <Eyebrow>Create a launch</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Set the rules once. Then nobody can bend them.</h1>
      <p className="mt-4 max-w-xl text-muted">You choose the token, the reserve price and the window. The auction does the rest, and you cannot see the bids either.</p>
      <div className="mt-5"><DemoNote>Demo: nothing is deployed</DemoNote></div>
      <div className="mt-10"><CreateForm /></div>
    </Container>
  );
}

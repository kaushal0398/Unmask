import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveLaunch } from "@/components/live-launch";
import { Container } from "@/components/ui";
import { LAUNCHES, getLaunch } from "@/lib/demo";

export function generateStaticParams() {
  return LAUNCHES.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/launches/[id]">): Promise<Metadata> {
  const l = getLaunch((await params).id);
  return { title: l ? `${l.name} ($${l.symbol})` : "Launch" };
}

async function LaunchBody({ params }: { params: PageProps<"/launches/[id]">["params"] }) {
  return <LiveLaunch id={(await params).id} />;
}

function LaunchSkeleton() {
  return (
    <div aria-busy className="space-y-8">
      <div className="h-6 w-28 rounded-none shimmer" />
      <div className="flex items-center gap-5">
        <div className="size-[84px] rounded-none shimmer" />
        <div className="space-y-3">
          <div className="h-9 w-64 rounded-none shimmer" />
          <div className="h-4 w-80 rounded-none shimmer" />
        </div>
      </div>
      <div className="h-96 rounded-none shimmer" />
    </div>
  );
}

export default function LaunchPage({ params }: PageProps<"/launches/[id]">) {
  return (
    <Container className="py-12 sm:py-16">
      <Suspense fallback={<LaunchSkeleton />}>
        <LaunchBody params={params} />
      </Suspense>
    </Container>
  );
}

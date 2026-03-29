import { ReviewPageClient } from "@/components/review/ReviewPageClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewPageClient videoId={id} />;
}

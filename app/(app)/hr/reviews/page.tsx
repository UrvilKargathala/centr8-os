import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyReviews } from "@/lib/api/reviews";
import { ReviewsPageClient, type MyReviewRow } from "./ReviewsPageClient";

export default async function ReviewsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ReviewsPageClient />;

  try {
    const initialMyReviews = await withOrgContext(userId, (db) => getMyReviews(db, userId, orgId));
    return <ReviewsPageClient initialMyReviews={initialMyReviews as unknown as MyReviewRow[]} />;
  } catch {
    return <ReviewsPageClient />;
  }
}

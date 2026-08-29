import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllDocuments } from "@/lib/api/aiAssistant";
import { DocumentsPageClient, type Doc } from "./DocumentsPageClient";

export default async function DocumentsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <DocumentsPageClient />;

  try {
    const initialDocs = await withOrgContext(userId, (db) => listAllDocuments(db, userId, orgId));
    return <DocumentsPageClient initialDocs={initialDocs as unknown as Doc[]} />;
  } catch {
    return <DocumentsPageClient />;
  }
}

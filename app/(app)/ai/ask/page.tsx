import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listMyConversations } from "@/lib/api/aiAssistant";
import { AskAiPageClient, type Conversation } from "./AskAiPageClient";

// Only the conversation sidebar list is seeded — which conversation is
// "active" and its messages are driven by useAskAiConversation's
// localStorage key (shared with the header widget), which a Server
// Component has no way to read, so that part stays client-driven.
export default async function AskAiPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <AskAiPageClient />;

  const initialConversations = await withOrgContext(userId, (db) => listMyConversations(db, orgId));
  return <AskAiPageClient initialConversations={initialConversations as unknown as Conversation[]} />;
}

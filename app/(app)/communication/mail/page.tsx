import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listGmailMessages, withConnectedGmail } from "@/lib/api/gmail";
import { requirePermission } from "@/lib/api/permissions";
import { MailPageClient, type MailInitialData } from "./MailPageClient";

// Seeds the default Inbox view (tab="Inbox", no search, no page token).
// Any other tab/search/pagination stays client-fetched, unchanged.
export default async function MailPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <MailPageClient />;

  try {
    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedGmail(db, orgId, (accessToken) =>
        listGmailMessages(accessToken, { labelIds: ["INBOX"], maxResults: 20 }),
      );
    });
    const initial: MailInitialData = {
      connected: true,
      messages: result.messages ?? [],
      nextPageToken: result.nextPageToken ?? null,
    };
    return <MailPageClient initial={initial} />;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const isNotConnected = msg.includes("isn't connected") || msg.includes("not connected");
    return <MailPageClient initial={isNotConnected ? { connected: false, messages: [], nextPageToken: null } : undefined} />;
  }
}

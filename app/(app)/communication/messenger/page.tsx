import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { fetchClickUpChatChannels, withConnectedClickUp } from "@/lib/api/clickup";
import { requirePermission } from "@/lib/api/permissions";
import { MessengerPageClient, type ClickUpChatChannel } from "./MessengerPageClient";

// Seeds connection status + channel list (the messages pane itself only
// loads once a channel is clicked, so there's nothing more to seed).
// Not connected / no permission both fall through to the client component
// with connected=false, same as the page's own client check resolving to
// false — CommunicationBanner already handles that state.
export default async function MessengerPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <MessengerPageClient />;

  try {
    const channels = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token) => fetchClickUpChatChannels(teamId, token));
    });
    return <MessengerPageClient initialConnected={true} initialChannels={channels as unknown as ClickUpChatChannel[]} />;
  } catch (err) {
    // "ClickUp is not connected" (ApiError 400 from withConnectedClickUp) is
    // the only case we seed connected=false for — any other failure (rate
    // limit, transient API error) leaves connected unseeded so the client's
    // own fetch + error handling takes over, instead of wrongly claiming
    // "not connected" for an org that actually is.
    const isNotConnected = err instanceof Error && err.message.includes("not connected");
    return <MessengerPageClient initialConnected={isNotConnected ? false : undefined} />;
  }
}

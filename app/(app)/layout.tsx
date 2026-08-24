import { redirect } from "next/navigation";
import { OrgProvider } from "@/lib/context/OrgContext";
import { AiUsageProvider } from "@/lib/context/AiUsageContext";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/currentOrg";

// Server Component so org selection is resolved before render — seeds
// OrgProvider with the cookie-selected org (falls back to the user's first
// org) so no page needs a client round trip just to know "which org."
// No middleware exists to gate (app) routes on auth, so this is also the
// first point that checks for a session; redirect to /login rather than
// letting an unauthenticated visit hit withOrgContext and throw.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { orgId, orgs, grants } = await getCurrentOrg(data.user.id);

  return (
    <OrgProvider initialOrgs={orgs} initialOrgId={orgId} initialGrants={grants}>
      <AiUsageProvider>
        <AppShell>{children}</AppShell>
      </AiUsageProvider>
    </OrgProvider>
  );
}

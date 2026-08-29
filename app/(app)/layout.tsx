import { redirect } from "next/navigation";
import { OrgProvider } from "@/lib/context/OrgContext";
import { AiUsageProvider } from "@/lib/context/AiUsageContext";
import { AppShell } from "@/components/AppShell";
import { getAuthUser } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/currentOrg";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { data } = await getAuthUser();
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

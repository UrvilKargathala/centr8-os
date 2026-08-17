import { OrgProvider } from "@/lib/context/OrgContext";
import { AiUsageProvider } from "@/lib/context/AiUsageContext";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <AiUsageProvider>
        <AppShell>{children}</AppShell>
      </AiUsageProvider>
    </OrgProvider>
  );
}

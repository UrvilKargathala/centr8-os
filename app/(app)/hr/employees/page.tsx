import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllEmployees } from "@/lib/api/employees";
import { EmployeesPageClient, type Employee } from "./EmployeesPageClient";

// Server-rendered: reuses lib/api/employees.ts's listAllEmployees, the same
// function app/api/employees's route calls. That function calls
// requirePermission internally and throws on denial — caught here so a
// permission-denied visit falls through to the client component with no
// initial data, which degrades to its own fetch + existing error handling
// exactly like it did before this page was server-rendered.
export default async function EmployeeDirectoryPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <EmployeesPageClient />;

  try {
    const employees = await withOrgContext(userId, (db) => listAllEmployees(db, userId, orgId));
    return <EmployeesPageClient initialEmployees={employees as unknown as Employee[]} />;
  } catch {
    return <EmployeesPageClient />;
  }
}

import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getEmployeeDetail } from "@/lib/api/employees";
import EmployeeDetailPageClient, { type Employee } from "./EmployeeDetailPageClient";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await getAuthUser();
  const userId = data.user!.id;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getEmployeeDetail(db, userId, id);
      if (!result) throw new Error("Employee not found");
      return result as unknown as Employee;
    });
    return <EmployeeDetailPageClient params={params} initial={initial} />;
  } catch {
    return <EmployeeDetailPageClient params={params} />;
  }
}

import { redirect } from "next/navigation";

export default async function DirectoryDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hr/employees/${id}`);
}

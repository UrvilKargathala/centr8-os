import { redirect } from "next/navigation";

// HR Batch 1 — Employee Directory moved to /hr/employees (List/Grid/Org
// Chart views, KPI cards, filters). Kept as a redirect so old links/
// bookmarks to /hr/directory don't break.
export default function DirectoryRedirect() {
  redirect("/hr/employees");
}

import { getAuthUser } from "@/lib/supabase/server";
import ProfilePageClient from "./ProfilePageClient";

export default async function ProfilePage() {
  const { data } = await getAuthUser();
  return <ProfilePageClient initialEmail={data.user?.email ?? null} />;
}

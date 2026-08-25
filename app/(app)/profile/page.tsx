import { createClient } from "@/lib/supabase/server";
import ProfilePageClient from "./ProfilePageClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return <ProfilePageClient initialEmail={data.user?.email ?? null} />;
}

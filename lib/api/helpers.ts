import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Browser callers authenticate via the Supabase session cookie; scripted/API
// callers (curl, future FR-6.x API clients) pass `Authorization: Bearer
// <access_token>` instead, since they have no cookie jar to carry a session.
export async function requireUserId(req?: NextRequest): Promise<string> {
  const supabase = await createClient();
  const bearer = req?.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];

  const { data, error } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return data.user.id;
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

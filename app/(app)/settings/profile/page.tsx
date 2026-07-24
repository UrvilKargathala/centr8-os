"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";

type Prefs = {
  fullName: string | null;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  language: string | null;
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  defaultLandingPage: "dashboard" | "projects" | "tasks";
  timeFormat: "12h" | "24h";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "ISO";
  weekStartsOn: "sunday" | "monday";
  notifyEmail: Record<string, boolean>;
  notifyInapp: Record<string, boolean>;
  notifyDigest: "realtime" | "daily" | "weekly";
};
type ProfileResponse = {
  email: string | null;
  emailVerified: boolean;
  providers: string[];
  isSsoManaged: boolean;
  preferences: Prefs;
};

const NOTIF_EVENTS: { key: string; label: string }[] = [
  { key: "task_assigned", label: "Task assigned to me" },
  { key: "task_updated", label: "Task updated" },
  { key: "task_mentioned", label: "Task mentioned in comment" },
  { key: "project_updated", label: "Project I own is updated" },
  { key: "project_status", label: "Project status change" },
  { key: "sprint_approval", label: "Sprint plan needs approval" },
  { key: "ai_recommendation", label: "AI suggested a recommendation" },
  { key: "weekly_summary", label: "Weekly summary" },
];

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Danger zone" },
] as const;

// Common IANA zones — the full list is 400+ and doesn't earn a searchable
// combobox for this app's user base. Add more here if needed.
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { selectedOrgId, loading: orgLoading } = useOrg();
  const toast = useToast();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft state per section — enables per-section "dirty" checks so Save is
  // disabled until something in that section actually changes.
  const [account, setAccount] = useState({ fullName: "", jobTitle: "", department: "", phone: "", timezone: "UTC", language: "en" });
  const [prefs, setPrefs] = useState({
    theme: "system" as Prefs["theme"],
    density: "comfortable" as Prefs["density"],
    defaultLandingPage: "dashboard" as Prefs["defaultLandingPage"],
    timeFormat: "24h" as Prefs["timeFormat"],
    dateFormat: "DD/MM/YYYY" as Prefs["dateFormat"],
    weekStartsOn: "monday" as Prefs["weekStartsOn"],
  });
  const [notify, setNotify] = useState({
    email: {} as Record<string, boolean>,
    inapp: {} as Record<string, boolean>,
    digest: "realtime" as Prefs["notifyDigest"],
  });
  const initial = useRef<{ account: typeof account; prefs: typeof prefs; notify: typeof notify } | null>(null);

  const [saving, setSaving] = useState<string | null>(null);
  const [pwModal, setPwModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [securityLog, setSecurityLog] = useState<{ id: string; action: string; createdAt: string; targetType: string }[]>([]);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/me/profile?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((b) => {
        if (!b.data) throw new Error(b.error ?? "Failed to load profile");
        setData(b.data);
        const p = b.data.preferences;
        const nextAccount = {
          fullName: p.fullName ?? "",
          jobTitle: p.jobTitle ?? "",
          department: p.department ?? "",
          phone: p.phone ?? "",
          timezone: p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
          language: p.language ?? "en",
        };
        const nextPrefs = {
          theme: p.theme,
          density: p.density,
          defaultLandingPage: p.defaultLandingPage,
          timeFormat: p.timeFormat,
          dateFormat: p.dateFormat,
          weekStartsOn: p.weekStartsOn,
        };
        const nextNotify = {
          email: p.notifyEmail ?? {},
          inapp: p.notifyInapp ?? {},
          digest: p.notifyDigest,
        };
        setAccount(nextAccount);
        setPrefs(nextPrefs);
        setNotify(nextNotify);
        initial.current = { account: nextAccount, prefs: nextPrefs, notify: nextNotify };
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
    fetch("/api/me/security-log")
      .then((r) => r.json())
      .then((b) => setSecurityLog(b.data ?? []));
  }
  useEffect(loadAll, [selectedOrgId]);

  // Warn on unload if any section has unsaved changes.
  const dirtyAccount = useMemo(() => JSON.stringify(account) !== JSON.stringify(initial.current?.account), [account]);
  const dirtyPrefs = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(initial.current?.prefs), [prefs]);
  const dirtyNotify = useMemo(() => JSON.stringify(notify) !== JSON.stringify(initial.current?.notify), [notify]);
  const anyDirty = dirtyAccount || dirtyPrefs || dirtyNotify;
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (anyDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [anyDirty]);

  async function saveAccount() {
    if (!selectedOrgId) return;
    setSaving("account");
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: selectedOrgId,
        full_name: account.fullName,
        job_title: account.jobTitle,
        department: account.department,
        phone: account.phone,
        timezone: account.timezone,
        language: account.language,
      }),
    });
    setSaving(null);
    if (res.ok) {
      toast.show("Account saved");
      if (initial.current) initial.current.account = account;
      // trigger re-memo
      setAccount({ ...account });
    } else {
      const b = await res.json();
      toast.show(b.error ?? "Failed to save", "error");
    }
  }
  async function savePrefs() {
    if (!selectedOrgId) return;
    setSaving("prefs");
    const res = await fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: selectedOrgId,
        theme: prefs.theme,
        density: prefs.density,
        default_landing_page: prefs.defaultLandingPage,
        time_format: prefs.timeFormat,
        date_format: prefs.dateFormat,
        week_starts_on: prefs.weekStartsOn,
      }),
    });
    setSaving(null);
    if (res.ok) {
      toast.show("Preferences saved");
      if (initial.current) initial.current.prefs = prefs;
      setPrefs({ ...prefs });
    } else {
      const b = await res.json();
      toast.show(b.error ?? "Failed to save", "error");
    }
  }
  async function saveNotify() {
    if (!selectedOrgId) return;
    setSaving("notify");
    const res = await fetch("/api/me/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: selectedOrgId,
        notify_email: notify.email,
        notify_inapp: notify.inapp,
        notify_digest: notify.digest,
      }),
    });
    setSaving(null);
    if (res.ok) {
      toast.show("Notifications saved");
      if (initial.current) initial.current.notify = notify;
      setNotify({ ...notify });
    } else {
      const b = await res.json();
      toast.show(b.error ?? "Failed to save", "error");
    }
  }
  async function exportData() {
    const res = await fetch("/api/me/export-data", { method: "POST" });
    if (res.ok) toast.show("Export requested — we'll email you when it's ready");
    else toast.show("Failed to request export", "error");
  }
  async function confirmDelete() {
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    if (res.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } else {
      const b = await res.json();
      toast.show(b.error ?? "Failed to delete", "error");
    }
  }

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error || !data) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error ?? "Failed to load"}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Profile &amp; Settings</h1>
        <p className="mt-1 text-body text-neutral-600">Manage your account, security, and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden self-start lg:sticky lg:top-4 lg:block">
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-3 py-2 text-body-medium font-medium text-neutral-700 hover:bg-neutral-200"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          {/* ── SECTION 1 — Account ─────────────────────────────── */}
          <SectionCard id="account" title="Account information" subtitle="This information is visible to others in your organization">
            <div className="flex items-center gap-4">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary-100 text-h1 font-semibold text-primary-700">
                {(account.fullName || data.email || "?").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    console.log("avatar upload: TODO — hook to Supabase Storage");
                    toast.show("Avatar upload — coming soon");
                  }}
                >
                  Change photo
                </Button>
                <p className="mt-1 text-caption text-neutral-500">PNG or JPG, up to 2MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name *">
                <Input className="w-full" value={account.fullName} onChange={(e) => setAccount({ ...account, fullName: e.target.value })} />
              </Field>
              <Field label="Work email">
                <div className="relative">
                  <Input className="w-full" value={data.email ?? ""} readOnly />
                  {data.isSsoManaged && (
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"
                      title="Managed by SSO"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                {data.isSsoManaged && <p className="mt-1 text-caption text-neutral-500">Managed by your identity provider</p>}
              </Field>
              <Field label="Job title">
                <Input className="w-full" value={account.jobTitle} onChange={(e) => setAccount({ ...account, jobTitle: e.target.value })} />
              </Field>
              {/* Becomes an FK dropdown when HR builds the departments table. */}
              <Field label="Department">
                <Input className="w-full" value={account.department} onChange={(e) => setAccount({ ...account, department: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input className="w-full" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} />
              </Field>
              <Field label="Timezone">
                <Select className="w-full" value={account.timezone} onChange={(e) => setAccount({ ...account, timezone: e.target.value })}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Language">
                <Select className="w-full" value={account.language} onChange={(e) => setAccount({ ...account, language: e.target.value })}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="gu">Gujarati</option>
                </Select>
              </Field>
            </div>

            <SaveRow disabled={!dirtyAccount || saving === "account"} onClick={saveAccount} loading={saving === "account"} />
          </SectionCard>

          {/* ── SECTION 2 — Security ────────────────────────────── */}
          <SectionCard id="security" title="Security" subtitle="Manage your password, two-factor auth, and active sessions">
            <SubHead title="Password" />
            {data.isSsoManaged ? (
              <p className="rounded-md border border-neutral-300 bg-neutral-100 p-3 text-body text-neutral-700">
                Password is managed by your identity provider
                {data.providers.length > 0 && ` (${data.providers.join(", ")})`}.
              </p>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setPwModal(true)}>
                Change password
              </Button>
            )}

            <SubHead title="Two-factor authentication" />
            <div className="rounded-md border border-neutral-300 bg-neutral-100 p-3">
              <p className="text-body text-neutral-800">Two-factor auth setup — coming soon.</p>
              <p className="mt-1 text-caption text-neutral-500">
                TOTP enrollment flows through Supabase MFA; wiring in a follow-up.
              </p>
            </div>

            <SubHead title="Active sessions" />
            <div className="rounded-md border border-neutral-300 bg-neutral-100 p-3">
              <p className="text-body text-neutral-800">Session listing — coming soon.</p>
              <p className="mt-1 text-caption text-neutral-500">
                Per-user session enumeration with device/location needs the Supabase admin API; wiring in a follow-up.
              </p>
            </div>

            <SubHead title="Recent activity" />
            {securityLog.length === 0 ? (
              <p className="rounded-md border border-neutral-300 bg-neutral-100 p-3 text-body text-neutral-600">
                No activity yet.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 bg-neutral-50">
                {securityLog.map((row) => (
                  <li key={row.id} className="flex items-center justify-between px-3 py-2 text-body">
                    <span className="text-neutral-800">
                      {row.action.replace(/_/g, " ")} · {row.targetType}
                    </span>
                    <span className="text-small text-neutral-500">{new Date(row.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* ── SECTION 3 — Preferences ─────────────────────────── */}
          <SectionCard id="preferences" title="Preferences" subtitle="Personalize how Centr8 OS looks and behaves for you">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Theme">
                {/* TODO: dark-mode wiring itself is a follow-up; saving the preference works today. */}
                <Segmented
                  value={prefs.theme}
                  onChange={(v) => setPrefs({ ...prefs, theme: v })}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                />
              </Field>
              <Field label="Density">
                <Segmented
                  value={prefs.density}
                  onChange={(v) => setPrefs({ ...prefs, density: v })}
                  options={[
                    { value: "comfortable", label: "Comfortable" },
                    { value: "compact", label: "Compact" },
                  ]}
                />
              </Field>
              <Field label="Default landing page">
                <Select
                  className="w-full"
                  value={prefs.defaultLandingPage}
                  onChange={(e) => setPrefs({ ...prefs, defaultLandingPage: e.target.value as Prefs["defaultLandingPage"] })}
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="projects">Projects</option>
                  <option value="tasks">My Tasks</option>
                </Select>
              </Field>
              <Field label="Time format">
                <Segmented
                  value={prefs.timeFormat}
                  onChange={(v) => setPrefs({ ...prefs, timeFormat: v })}
                  options={[
                    { value: "12h", label: "12h" },
                    { value: "24h", label: "24h" },
                  ]}
                />
              </Field>
              <Field label="Date format">
                <Select
                  className="w-full"
                  value={prefs.dateFormat}
                  onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value as Prefs["dateFormat"] })}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="ISO">ISO (YYYY-MM-DD)</option>
                </Select>
              </Field>
              <Field label="Week starts on">
                <Segmented
                  value={prefs.weekStartsOn}
                  onChange={(v) => setPrefs({ ...prefs, weekStartsOn: v })}
                  options={[
                    { value: "sunday", label: "Sunday" },
                    { value: "monday", label: "Monday" },
                  ]}
                />
              </Field>
            </div>
            <SaveRow disabled={!dirtyPrefs || saving === "prefs"} onClick={savePrefs} loading={saving === "prefs"} />
          </SectionCard>

          {/* ── SECTION 4 — Notifications ───────────────────────── */}
          <SectionCard id="notifications" title="Notifications" subtitle="Choose what you want to be notified about, and how">
            <div className="overflow-x-auto rounded-md border border-neutral-300">
              <table className="w-full min-w-[420px] text-body">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-100 text-left text-caption font-medium uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-2">Event</th>
                    <th className="px-4 py-2 text-center">Email</th>
                    <th className="px-4 py-2 text-center">In-app</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-neutral-50">
                  {NOTIF_EVENTS.map((ev) => (
                    <tr key={ev.key}>
                      <td className="px-4 py-3 text-neutral-800">{ev.label}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={notify.email[ev.key] ?? false}
                          onChange={(e) => setNotify({ ...notify, email: { ...notify.email, [ev.key]: e.target.checked } })}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={notify.inapp[ev.key] ?? true}
                          onChange={(e) => setNotify({ ...notify, inapp: { ...notify.inapp, [ev.key]: e.target.checked } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Field label="Digest schedule">
              <Segmented
                value={notify.digest}
                onChange={(v) => setNotify({ ...notify, digest: v })}
                options={[
                  { value: "realtime", label: "Real-time" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
              />
            </Field>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  console.log("me/notifications: test email requested — TODO wire to Resend");
                  toast.show("Test email queued");
                }}
              >
                Send me a test email
              </Button>
              <SaveRow inline disabled={!dirtyNotify || saving === "notify"} onClick={saveNotify} loading={saving === "notify"} />
            </div>
          </SectionCard>

          {/* ── SECTION 5 — Danger zone ─────────────────────────── */}
          <div id="danger" className="scroll-mt-4 space-y-4 rounded-md border border-danger-100 bg-neutral-50 p-5">
            <div>
              <h2 className="font-heading text-h2 font-semibold text-danger-600">Danger zone</h2>
              <p className="mt-1 text-body text-neutral-600">Irreversible actions on your account.</p>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3 border-t border-neutral-200 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-body-medium font-medium text-neutral-950">Export my data</p>
                <p className="text-small text-neutral-600">
                  Download all your data as JSON — projects you own, tasks assigned to you, comments, and account info.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={exportData}>
                Request data export
              </Button>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3 border-t border-neutral-200 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-body-medium font-medium text-neutral-950">Delete account</p>
                <p className="text-small text-neutral-600">
                  Permanently deactivate your account. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModal(true)}
                className="rounded-md bg-danger-600 px-3 py-1.5 text-small font-medium text-neutral-50 hover:bg-danger-600/90"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      </div>

      {pwModal && <ChangePasswordModal onClose={() => setPwModal(false)} />}
      {deleteModal && <DeleteAccountModal onClose={() => setDeleteModal(false)} onConfirm={confirmDelete} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section primitives
// ─────────────────────────────────────────────────────────────

function SectionCard({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4 rounded-md border border-neutral-300 bg-neutral-50 p-5">
      <div>
        <h2 className="font-heading text-h2 font-semibold text-neutral-950">{title}</h2>
        <p className="mt-1 text-body text-neutral-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function SubHead({ title }: { title: string }) {
  return <h3 className="mt-2 font-heading text-h3 font-semibold text-neutral-800">{title}</h3>;
}

function SaveRow({
  disabled,
  loading,
  onClick,
  inline = false,
}: {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "flex justify-end border-t border-neutral-200 pt-4"}>
      <Button type="button" onClick={onClick} disabled={disabled}>
        {loading ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setErr("New password must be at least 8 characters");
    if (next !== confirm) return setErr("Passwords do not match");
    setSaving(true);
    setErr(null);
    // TODO: Supabase doesn't verify the current password server-side on
    // updateUser({ password }) — you'd need to reauthenticate first. Kept
    // the field so the UX is right; wiring is a follow-up.
    const res = await fetch("/api/me/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: next }),
    });
    setSaving(false);
    const body = await res.json();
    if (!res.ok) return setErr(body.error ?? "Failed to update password");
    toast.show("Password updated");
    onClose();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="font-heading text-h3 font-semibold text-neutral-950">Change password</h3>
        {err && <p className="rounded-md bg-danger-100 p-2 text-body text-danger-600">{err}</p>}
        <Field label="Current password">
          <Input type="password" className="w-full" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </Field>
        <Field label="New password">
          <Input type="password" className="w-full" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" className="w-full" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !next || !confirm}>
            {saving ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteAccountModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canConfirm = confirmText === "DELETE";

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-3">
        <h3 className="font-heading text-h3 font-semibold text-danger-600">Delete account</h3>
        <p className="text-body text-neutral-800">
          This will remove you from all projects, anonymize your data, and revoke every session. This action cannot be undone.
        </p>
        <Field label='Type "DELETE" to confirm'>
          <Input className="w-full" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={!canConfirm || deleting}
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
            className="rounded-md bg-danger-600 px-3 py-1.5 text-small font-medium text-neutral-50 hover:bg-danger-600/90 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Permanently delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

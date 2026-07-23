"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

// icons reused across items that share a shape; "" falls back to a generic dot.
const ICON = {
  dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  checklist: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  bars: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14",
  bolt: "M13 10V3L4 14h7v7l9-11h-7z",
  heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  users: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8",
  chat: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  phone: "M3 5a2 2 0 012-2h3.28a1 1 0 011 .76l1.12 4.49a1 1 0 01-.29.95l-1.6 1.6a11.04 11.04 0 005.53 5.53l1.6-1.6a1 1 0 01.95-.29l4.49 1.12a1 1 0 01.76 1V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z",
  video: "M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
  target: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z",
  gauge: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 5v5l3 3",
  scale: "M12 3v18M5 8l-3 6a4 4 0 008 0l-3-6zm14 0l-3 6a4 4 0 008 0l-3-6zM3 8h6M15 8h6",
  currency: "M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12c1.598 0 2.978.8 3.6 1.964M12 8V6m0 2v8m0 0v2m0-2c-1.598 0-2.978-.8-3.6-1.964",
  wallet: "M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01",
  robot: "M9 3v2m6-2v2M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2zm2 6a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z",
  doc: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  sparkle: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  key: "M15 7a4 4 0 10-4 4v0l-5 5v3h3l5-5a4 4 0 001-7z",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  plug: "M13 10V3L4 14h7v7l9-11h-7z",
};

type NavItem = { href: string; label: string; icon: string; comingSoon?: boolean };
type NavSection = { title: string; icon: string; items: NavItem[]; adminOnly?: boolean };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Project Management",
    icon: ICON.checklist,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: ICON.dashboard },
      { href: "/projects", label: "Projects", icon: ICON.folder },
      { href: "/sprints", label: "Sprints", icon: ICON.checklist },
      { href: "/tasks", label: "Tasks", icon: ICON.checklist },
    ],
  },
  {
    title: "HR Management",
    icon: ICON.users,
    items: [
      { href: "/hr/dashboard", label: "Dashboard", icon: ICON.dashboard },
      { href: "/hr/directory", label: "Employee Directory", icon: ICON.users },
      { href: "/hr/attendance", label: "Attendance & Time Tracking", icon: ICON.gauge },
      { href: "/hr/leave", label: "Leave Management", icon: ICON.doc },
      { href: "/hr/payroll", label: "Payroll & Compensation", icon: ICON.currency },
      { href: "/hr/reviews", label: "Performance Reviews & OKRs", icon: ICON.target },
      { href: "/hr/recruitment", label: "Recruitment / Hiring", icon: ICON.users },
      { href: "/hr/cases", label: "HR Cases & Helpdesk", icon: ICON.chat },
      { href: "/hr/learning", label: "Learning & Training (LMS)", icon: ICON.doc },
      { href: "/hr/engagement", label: "Employee Engagement / Surveys", icon: ICON.heart },
      { href: "/hr/holidays", label: "Holidays", icon: ICON.doc },
    ],
  },
  {
    title: "Communication",
    icon: ICON.chat,
    items: [
      { href: "/comms/messenger", label: "Messenger", icon: ICON.chat, comingSoon: true },
      { href: "/comms/mail", label: "Mail", icon: ICON.mail, comingSoon: true },
      { href: "/comms/calls", label: "Calls", icon: ICON.phone, comingSoon: true },
      { href: "/comms/video", label: "Video Conferencing", icon: ICON.video, comingSoon: true },
    ],
  },
  {
    title: "CRM",
    icon: ICON.wallet,
    items: [
      { href: "/crm/leads", label: "Leads", icon: ICON.target },
      { href: "/crm/contacts", label: "Contacts", icon: ICON.users },
      { href: "/crm/accounts", label: "Accounts", icon: ICON.folder },
      { href: "/crm/deals", label: "Deals / Pipeline", icon: ICON.wallet },
      { href: "/crm/activities", label: "Activities", icon: ICON.checklist, comingSoon: true },
      { href: "/crm/forecasts", label: "Sales Forecasts", icon: ICON.gauge },
      { href: "/crm/campaigns", label: "Campaigns", icon: ICON.sparkle },
    ],
  },
  {
    title: "Resources",
    icon: ICON.gauge,
    items: [
      { href: "/sprints", label: "Capacity Planning", icon: ICON.gauge },
      { href: "/budgets", label: "Budgets", icon: ICON.currency, comingSoon: true },
    ],
  },
  {
    title: "AI Assistant",
    icon: ICON.sparkle,
    items: [
      { href: "/ai/create-project", label: "AI Draft", icon: ICON.bolt },
      { href: "/health", label: "Health Monitoring", icon: ICON.heart },
      { href: "/ai/sprint-plans", label: "Sprint Plans", icon: ICON.checklist, comingSoon: true },
      { href: "/ai/ask", label: "Ask AI", icon: ICON.sparkle, comingSoon: true },
      { href: "/ai/documents", label: "Documents", icon: ICON.doc, comingSoon: true },
      { href: "/ai/recommendations", label: "Recommendations", icon: ICON.sparkle, comingSoon: true },
    ],
  },
  {
    title: "Insights",
    icon: ICON.bars,
    items: [{ href: "/executive", label: "Executive Dashboard", icon: ICON.bars }],
  },
  {
    title: "Administration",
    icon: ICON.shield,
    adminOnly: true,
    items: [
      { href: "/admin/members", label: "Members & Roles", icon: ICON.users },
      { href: "/profile", label: "SSO & Security", icon: ICON.shield },
      { href: "/admin/automations", label: "Automations", icon: ICON.robot, comingSoon: true },
      { href: "/profile", label: "API Keys", icon: ICON.key },
      { href: "/admin/audit-log", label: "Audit Log", icon: ICON.clipboard, comingSoon: true },
      { href: "/admin/integrations", label: "Integrations", icon: ICON.plug },
    ],
  },
];

// Closes the mobile sidebar sheet on route change — SidebarProvider doesn't
// do this itself, and useSidebar() only works inside SidebarProvider, so
// this has to live below it as its own component rather than in AppShell.
function CloseMobileNavOnRouteChange() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_SECTIONS.map((s) => [s.title, true])),
  );

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 flex-row items-center gap-2 border-b border-neutral-300 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary-600 text-caption font-semibold text-neutral-50">
          C8
        </div>
        <span className="text-h3 font-semibold text-neutral-950">Centr8 OS</span>
      </SidebarHeader>

      <SidebarContent className="gap-4 p-3 font-heading">
        {NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin).map((section) => (
          <SidebarGroup key={section.title} className="space-y-0.5 p-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [section.title]: !c[section.title] }))}
              className="flex w-full items-center gap-2 px-3 pb-1 font-heading text-[13px] font-semibold tracking-wide text-neutral-500 hover:text-neutral-700"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
              </svg>
              <span className="flex-1 text-left">{section.title}</span>
              <svg
                className={`h-3 w-3 shrink-0 transition-transform ${collapsed[section.title] ? "-rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!collapsed[section.title] && (
              <SidebarMenu>
                {section.items.map((item, i) => {
                  if (item.comingSoon) {
                    return (
                      <SidebarMenuItem key={`${item.href}-${i}`}>
                        <div className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium text-neutral-400">
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                          <span className="flex-1">{item.label}</span>
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-neutral-200 px-1.5 py-0.5 text-caption text-neutral-500">
                            Soon
                          </span>
                        </div>
                      </SidebarMenuItem>
                    );
                  }
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <SidebarMenuItem key={`${item.href}-${i}`}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={`h-auto gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium ${
                          active
                            ? "bg-primary-100 text-primary-700 hover:bg-primary-100 hover:text-primary-700 data-active:bg-primary-100 data-active:text-primary-700"
                            : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-600"
                        }`}
                      >
                        <Link href={item.href}>
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                          {item.label}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { orgs, selectedOrgId, setSelectedOrgId, loading, can } = useOrg();
  const isAdmin = can("sso", "configure");
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarProvider className="min-h-screen bg-neutral-100">
      <CloseMobileNavOnRouteChange />
      <AppSidebar isAdmin={isAdmin} />

      <SidebarInset className="min-w-0 bg-neutral-100">
        <header className="flex h-14 items-center gap-2 border-b border-neutral-300 bg-neutral-50 px-3 sm:px-6">
          <SidebarTrigger className="md:hidden" />

          <div className="relative hidden max-w-sm flex-1 md:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search"
              disabled
              title="Search is not wired up yet"
              className="w-full rounded-sm border border-neutral-300 bg-neutral-50 py-1.5 pl-9 pr-3 text-body text-neutral-950 placeholder:text-neutral-400 focus:outline focus:outline-2 focus:outline-primary-600 disabled:cursor-not-allowed"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {loading ? (
              <span className="hidden text-body text-neutral-600 sm:inline">Loading orgs…</span>
            ) : orgs.length === 0 ? (
              <span className="hidden text-body text-warning-600 sm:inline">Not a member of any organization</span>
            ) : (
              <select
                value={selectedOrgId ?? ""}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-28 rounded-sm border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-body focus:outline focus:outline-2 focus:outline-primary-600 sm:w-auto sm:px-3"
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} · {org.role}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              disabled
              title="Notifications aren't wired up yet"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.66V5a2 2 0 10-4 0v.34A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-neutral-200"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-caption font-medium text-neutral-50">
                  {(email ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden flex-col items-start sm:flex">
                  <span className="max-w-[10rem] truncate text-body-medium font-medium leading-tight text-neutral-950">
                    {email ?? "Account"}
                  </span>
                  <span className="text-caption capitalize leading-tight text-neutral-500">
                    {orgs.find((o) => o.id === selectedOrgId)?.role ?? "—"}
                  </span>
                </span>
                <svg className="hidden h-3.5 w-3.5 text-neutral-600 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-neutral-300 bg-neutral-50 py-1 shadow-lg">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-body text-neutral-800 hover:bg-neutral-200"
                  >
                    Profile settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-3 py-2 text-left text-body text-danger-600 hover:bg-neutral-200"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

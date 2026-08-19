"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import lottie from "lottie-web/build/player/lottie_light";
import aiAnimationData from "@/public/ai-animation.json";
import { usePathname, useRouter } from "next/navigation";
import { useOrg } from "@/lib/context/OrgContext";
import { useAiUsage } from "@/lib/context/AiUsageContext";
import { createClient } from "@/lib/supabase/client";
import { ToastProvider } from "@/components/ui/Toast";
import { AttendanceWidget } from "@/components/hr/AttendanceWidget";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  ChatInput,
  HeroEmptyState,
  MessageList,
  useAskAiConversation,
} from "@/components/ai/AskAiChat";

// icons reused across items that share a shape.
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
  currency: "M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12c1.598 0 2.978.8 3.6 1.964M12 8V6m0 2v8m0 0v2m0-2c-1.598 0-2.978-.8-3.6-1.964",
  wallet: "M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01",
  robot: "M9 3v2m6-2v2M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2zm2 6a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z",
  doc: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  sparkle: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  key: "M15 7a4 4 0 10-4 4v0l-5 5v3h3l5-5a4 4 0 001-7z",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  plug: "M13 10V3L4 14h7v7l9-11h-7z",
  help: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14a3 3 0 00-3 3m3-3a3 3 0 013 3c0 1.66-3 3-3 3v1m0 3h.01",
  logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1",
  chevronLeft: "M15 19l-7-7 7-7",
  chevronRight: "M9 5l7 7-7 7",
  chevronDown: "M19 9l-7 7-7-7",
  // Global command-center dashboard — a home icon, distinct from the
  // per-pillar "dashboard" (a line chart icon) used inside Project
  // Management/HR. Kept the "grid" key name (referenced elsewhere) even
  // though the shape is now a house, to avoid a churny rename.
  grid: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3v-6a1 1 0 011-1h4a1 1 0 011 1v6h3a1 1 0 001-1V10m-9-7l9 7",
};

type NavItem = { href: string; label: string; icon: string; comingSoon?: boolean };
type NavSection = { title: string; icon: string; items: NavItem[]; adminOnly?: boolean };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Project Management",
    icon: ICON.checklist,
    items: [
      { href: "/projects/dashboard", label: "Dashboard", icon: ICON.dashboard },
      { href: "/projects", label: "Projects", icon: ICON.folder },
      { href: "/tasks", label: "Tasks", icon: ICON.checklist },
      { href: "/team", label: "Team", icon: ICON.users },
      { href: "/projects/time-tracking", label: "Time Tracking", icon: ICON.gauge },
    ],
  },
  {
    title: "HR Management",
    icon: ICON.users,
    items: [
      { href: "/hr/dashboard", label: "Dashboard", icon: ICON.dashboard },
      { href: "/hr/employees", label: "Employee Directory", icon: ICON.users },
      { href: "/hr/onboarding", label: "Onboarding", icon: ICON.checklist },
      { href: "/hr/attendance", label: "Attendance & Time", icon: ICON.gauge },
      { href: "/hr/leave", label: "Leave", icon: ICON.doc },
      { href: "/hr/payroll", label: "Payroll", icon: ICON.currency },
      { href: "/hr/reviews", label: "Reviews & OKRs", icon: ICON.target },
      { href: "/hr/recruitment", label: "Recruitment", icon: ICON.users },
      { href: "/hr/cases", label: "Cases & Helpdesk", icon: ICON.chat },
      { href: "/hr/training", label: "Learning (LMS)", icon: ICON.doc },
      { href: "/hr/surveys", label: "Engagement", icon: ICON.heart },
      { href: "/hr/holidays", label: "Holidays", icon: ICON.doc },
    ],
  },
  {
    title: "CRM",
    icon: ICON.wallet,
    items: [
      { href: "/crm", label: "Dashboard", icon: ICON.dashboard },
      { href: "/crm/leads", label: "Leads", icon: ICON.target },
      { href: "/crm/contacts", label: "Contacts", icon: ICON.users },
      { href: "/crm/accounts", label: "Accounts", icon: ICON.folder },
      { href: "/crm/activities", label: "Activities", icon: ICON.checklist },
      { href: "/crm/deals", label: "Deals / Pipeline", icon: ICON.wallet },
      { href: "/crm/forecasts", label: "Sales Forecasts", icon: ICON.gauge },
      { href: "/crm/campaigns", label: "Campaigns", icon: ICON.sparkle },
    ],
  },
  {
    title: "Communication",
    icon: ICON.chat,
    items: [
      { href: "/communication", label: "Unified Inbox", icon: ICON.dashboard },
      { href: "/communication/messenger", label: "Messenger", icon: ICON.chat },
      { href: "/communication/mail", label: "Mail", icon: ICON.mail },
      { href: "/communication/calls", label: "Calls", icon: ICON.phone },
      { href: "/communication/video", label: "Video", icon: ICON.video },
      { href: "/communication/clickup", label: "ClickUp", icon: ICON.clipboard },
    ],
  },
  {
    title: "Resources",
    icon: ICON.gauge,
    items: [
      { href: "/capacity", label: "Capacity Planning", icon: ICON.gauge },
      { href: "/budgets", label: "Budgets", icon: ICON.currency },
      { href: "/resources/forecasting", label: "Forecasting", icon: ICON.bars },
    ],
  },
  {
    title: "AI Assistant",
    icon: ICON.sparkle,
    items: [
      { href: "/ai/create-project", label: "AI Draft", icon: ICON.bolt },
      { href: "/health", label: "Health Monitoring", icon: ICON.heart },
      { href: "/ai/sprint-plans", label: "Sprint Plans", icon: ICON.checklist },
      { href: "/ai/ask", label: "Ask AI", icon: ICON.sparkle },
      { href: "/ai/documents", label: "Documents", icon: ICON.doc },
      { href: "/ai/recommendations", label: "Recommendations", icon: ICON.sparkle },
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
      { href: "/admin/sso-security", label: "SSO & Security", icon: ICON.shield, comingSoon: true },
      { href: "/admin/automations", label: "Automations", icon: ICON.robot, comingSoon: true },
      { href: "/admin/api-keys", label: "API Keys", icon: ICON.key, comingSoon: true },
      { href: "/admin/audit-log", label: "Audit Log", icon: ICON.clipboard },
      { href: "/admin/integrations", label: "Integrations", icon: ICON.plug },
    ],
  },
];

// Deterministic tint from the org name so switching between two orgs is
// visually obvious at a glance — same hash approach used on TaskCard avatars.
const ORG_AVATAR_COLORS = [
  "bg-primary-600",
  "bg-info-600",
  "bg-success-600",
  "bg-warning-600",
  "bg-danger-600",
  "bg-ai-600",
];
function OrgAvatar({ name }: { name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const color = ORG_AVATAR_COLORS[hash % ORG_AVATAR_COLORS.length];
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-caption font-semibold text-neutral-50 ${color}`}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// Longest-prefix wins. Without this a parent item like "/communication" would
// stay active on every child route ("/communication/mail" etc.) alongside the
// child item, lighting both up at once.
function isItemActive(item: NavItem, siblings: NavItem[], pathname: string) {
  if (pathname === item.href) return true;
  const isPrefixMatch = pathname.startsWith(item.href + "/");
  if (!isPrefixMatch) return false;
  const longerMatch = siblings.some(
    (o) => o !== item && o.href.length > item.href.length && (pathname === o.href || pathname.startsWith(o.href + "/")),
  );
  return !longerMatch;
}

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function AskAiLottie() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const anim = lottie.loadAnimation({
      container: container.current,
      animationData: aiAnimationData,
      renderer: "svg",
      loop: true,
      autoplay: true,
    });
    return () => anim.destroy();
  }, []);
  return <div ref={container} className="h-5 w-5" />;
}

// Item rendered in a flyout (collapsed-hover) or inline (expanded).
function NavLeaf({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  const base = `flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium ${
    compact ? "" : ""
  }`;
  if (item.comingSoon) {
    return (
      <div className={`${base} text-neutral-400`}>
        <Icon path={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
        <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 py-0.5 text-caption text-neutral-500">Soon</span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      className={`${base} ${
        active ? "bg-primary-100 text-primary-700" : "text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      <Icon path={item.icon} />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function AppSidebar({
  isAdmin,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  email,
  onSignOut,
}: {
  isAdmin: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  email: string | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hoverSection, setHoverSection] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const groups = [
    { label: "MAIN", sections: NAV_SECTIONS.filter((s) => !s.adminOnly) },
    { label: "SETTINGS", sections: NAV_SECTIONS.filter((s) => s.adminOnly && isAdmin) },
  ].filter((g) => g.sections.length > 0);

  function isSectionActive(section: NavSection) {
    return section.items.some((i) => !i.comingSoon && (pathname === i.href || pathname.startsWith(i.href + "/")));
  }

  function onIconEnter(e: React.MouseEvent<HTMLElement>, sectionTitle: string) {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverSection(sectionTitle);
    setHoverPos({ top: rect.top, left: rect.right + 6 });
  }

  const hoveredSection = groups.flatMap((g) => g.sections).find((s) => s.title === hoverSection);
  const width = collapsed ? "w-16" : "w-64";

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-neutral-950/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col glass transition-[width,transform] duration-200 md:static md:translate-x-0 ${width} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex h-14 shrink-0 items-center gap-2 border-b border-neutral-300 px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/c8-favicon.png" alt="Centr8 OS" className="h-7 w-7 shrink-0 rounded-sm object-contain" />
          {!collapsed && <span className="text-h3 font-semibold text-neutral-950">Centr8 OS</span>}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300 bg-neutral-50 text-neutral-600 shadow-sm hover:text-neutral-950 md:flex"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon path={collapsed ? ICON.chevronRight : ICON.chevronLeft} className="h-3 w-3" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3 font-heading">
          <Link
            href="/dashboard"
            title="Dashboard"
            className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium ${
              pathname === "/dashboard" ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-200"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <Icon path={ICON.grid} />
            {!collapsed && <span>Dashboard</span>}
          </Link>

          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p
                className={`text-caption font-semibold tracking-wider text-neutral-400 ${
                  collapsed ? "text-center" : "px-3"
                }`}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.sections.map((section) => {
                  const active = isSectionActive(section);
                  const isExpanded = !collapsed && expanded[section.title];
                  const header = (
                    <button
                      type="button"
                      onMouseEnter={(e) => onIconEnter(e, section.title)}
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          setExpanded((prev) => ({ ...prev, [section.title]: true }));
                          setHoverSection(null);
                        } else {
                          setExpanded((prev) => ({ ...prev, [section.title]: !prev[section.title] }));
                        }
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium ${
                        active
                          ? "bg-primary-100 text-primary-700"
                          : "text-neutral-700 hover:bg-neutral-200"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon path={section.icon} />
                      {!collapsed && <span className="flex-1 text-left">{section.title}</span>}
                      {!collapsed && (
                        <Icon
                          path={ICON.chevronDown}
                          className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                        />
                      )}
                    </button>
                  );
                  return (
                    <div key={section.title}>
                      {header}
                      {isExpanded && (
                        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-neutral-200 pl-2">
                          {section.items.map((item, i) => (
                            <NavLeaf
                              key={`${item.href}-${i}`}
                              item={item}
                              active={isItemActive(item, section.items, pathname)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-neutral-300 p-3 font-heading">
          <Link
            href="/profile"
            className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium text-neutral-600 hover:bg-neutral-200 ${
              collapsed ? "justify-center" : ""
            }`}
            title="Help"
          >
            <Icon path={ICON.help} />
            {!collapsed && <span>Help</span>}
          </Link>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 hover:bg-neutral-200 ${
                collapsed ? "justify-center" : ""
              }`}
              title={email ?? "Account"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/avatar.png"
                alt={email ?? "Account"}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-neutral-700">
                  {email ?? "Account"}
                </span>
              )}
            </button>

            {userMenuOpen && (
              <div className={`absolute z-50 w-48 rounded-md glass py-1 shadow-lg ${
                collapsed ? "bottom-0 left-full ml-2" : "bottom-full left-0 mb-1"
              }`}>
                <Link
                  href="/settings/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2 text-body text-neutral-800 hover:bg-neutral-200"
                >
                  Profile &amp; Settings
                </Link>
                <button
                  onClick={onSignOut}
                  className="block w-full px-3 py-2 text-left text-body text-danger-600 hover:bg-neutral-200"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {collapsed && hoveredSection && hoverPos && (
        <div
          onMouseLeave={() => setHoverSection(null)}
          onMouseEnter={() => {
            /* keep it open while hovered */
          }}
          className="fixed z-50 w-56 rounded-md glass p-2 shadow-lg"
          style={{ top: hoverPos.top, left: hoverPos.left }}
        >
          <p className="px-2 pb-1 text-caption font-semibold uppercase tracking-wider text-neutral-500">
            {hoveredSection.title}
          </p>
          <div className="space-y-0.5">
            {hoveredSection.items.map((item, i) => (
              <NavLeaf
                key={`${item.href}-${i}`}
                item={item}
                active={isItemActive(item, hoveredSection.items, pathname)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { orgs, selectedOrgId, setSelectedOrgId, loading, can } = useOrg();
  const isAdmin = can("sso", "configure");
  const [email, setEmail] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const { callCount: aiCallCount } = useAiUsage();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const v = localStorage.getItem("centr8:sidebar-collapsed");
    if (v === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("centr8:sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Close mobile off-canvas on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) setOrgMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const stored = (localStorage.getItem("centr8:theme") ?? "light") as "light" | "dark";
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("centr8:theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }

  function applyTheme(t: "light" | "dark") {
    document.documentElement.classList.toggle("dark", t === "dark");
  }


  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <ToastProvider>
    <div className="flex h-screen bg-neutral-100">
      <AppSidebar
        isAdmin={isAdmin}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        email={email}
        onSignOut={handleSignOut}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-14 items-center gap-2 glass px-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-200 md:hidden"
            aria-label="Open menu"
          >
            <Icon path="M4 6h16M4 12h16M4 18h16" className="h-5 w-5" />
          </button>

          <div className="relative hidden max-w-[200px] flex-1 md:block">
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
              className="w-full rounded-sm border border-neutral-300 bg-neutral-50 py-1.5 pl-9 pr-3 text-body text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-primary-600 disabled:cursor-not-allowed"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <AttendanceWidget />

            <div className="hidden h-5 w-px bg-neutral-300 sm:block" />

            <button
              type="button"
              onClick={() => setAskOpen(true)}
              title="Ask AI"
              className="relative flex h-9 items-center gap-1.5 rounded-sm border border-ai-600 px-2.5 text-small font-medium text-ai-600 hover:bg-ai-100"
            >
              <AskAiLottie />
              <span className="hidden sm:inline">Ask AI</span>
              {aiCallCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ai-600 px-1 text-[10px] font-bold text-white">
                  {aiCallCount}
                </span>
              )}
            </button>

            <div className="hidden h-5 w-px bg-neutral-300 sm:block" />

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-200"
            >
              {theme === "dark" ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <NotificationBell orgId={selectedOrgId} />

            <div className="hidden h-5 w-px bg-neutral-300 sm:block" />

            {loading ? (
              <span className="hidden text-body text-neutral-600 sm:inline">Loading…</span>
            ) : orgs.length === 0 ? (
              <span className="hidden text-body text-warning-600 sm:inline">No org</span>
            ) : (
              <div className="relative" ref={orgMenuRef}>
                <button
                  type="button"
                  onClick={() => setOrgMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-neutral-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/c8-favicon.png"
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-md object-cover"
                  />
                  <span className="hidden max-w-[10rem] truncate text-small font-medium text-neutral-700 sm:inline">
                    {orgs.find((o) => o.id === selectedOrgId)?.name ?? "Select org"}
                  </span>
                  <Icon path={ICON.chevronDown} className="h-3 w-3 text-neutral-400" />
                </button>

                {orgMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md glass shadow-lg">
                    <p className="border-b border-neutral-200 px-3 py-2 text-caption font-semibold uppercase tracking-wider text-neutral-500">
                      Organizations
                    </p>
                    <ul className="max-h-72 overflow-y-auto py-1">
                      {orgs.map((org) => {
                        const active = org.id === selectedOrgId;
                        return (
                          <li key={org.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrgId(org.id);
                                setOrgMenuOpen(false);
                              }}
                              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-neutral-100 ${
                                active ? "bg-neutral-100" : ""
                              }`}
                            >
                              <OrgAvatar name={org.name} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-body-medium font-medium text-neutral-950">
                                  {org.name}
                                </span>
                                <span className="block text-caption capitalize text-neutral-500">{org.role}</span>
                              </span>
                              {active && (
                                <Icon path="M5 13l4 4L19 7" className="h-4 w-4 shrink-0 text-primary-600" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      href="/admin/members"
                      onClick={() => setOrgMenuOpen(false)}
                      className="block border-t border-neutral-200 px-3 py-2 text-small text-neutral-700 hover:bg-neutral-100"
                    >
                      Manage organization →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {askOpen && <AskAiDialog onClose={() => setAskOpen(false)} orgId={selectedOrgId} />}
    </div>
    </ToastProvider>
  );
}

function AskAiDialog({ onClose, orgId }: { onClose: () => void; orgId: string | null }) {
  const { conversationId, messages, sending, streamingId, error, sendMessage, sendStarter } = useAskAiConversation(orgId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/40" onClick={onClose}>
      <div
        className="flex h-full w-[440px] max-w-full flex-col glass shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-300 p-4">
          <div className="flex items-center gap-2">
            <Icon path={ICON.sparkle} className="h-5 w-5 text-ai-600" />
            <h2 className="font-heading text-h3 font-semibold text-neutral-950">Ask AI</h2>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/ai/ask" className="text-small text-primary-700 underline" onClick={onClose}>
              Open full page
            </Link>
            <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-neutral-800">
              <Icon path="M6 18L18 6M6 6l12 12" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!conversationId ? (
          <HeroEmptyState compact onPick={(text) => sendStarter(text)} />
        ) : (
          <MessageList messages={messages} sending={sending} streamingId={streamingId} error={error} />
        )}

        {conversationId && <ChatInput disabled={sending} onSend={(text) => sendMessage(text)} />}
      </div>
    </div>
  );
}

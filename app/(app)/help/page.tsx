"use client";

import { useState } from "react";

const KEYBOARD_SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open search" },
  { keys: ["⌘", "B"], description: "Toggle sidebar" },
  { keys: ["⌘", "N"], description: "New project / task" },
  { keys: ["Esc"], description: "Close modal or panel" },
];

type FaqItem = { q: string; a: string };

const FAQ_SECTIONS: { title: string; icon: string; items: FaqItem[] }[] = [
  {
    title: "Getting Started",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    items: [
      {
        q: "How do I create my first project?",
        a: "Go to Project Management → Projects and click '+ New Project'. The wizard walks you through setting a name, timeline, budget, team, and optional document attachments.",
      },
      {
        q: "How do I invite team members?",
        a: "Go to Administration → Members & Roles. Click 'Invite Member', enter their email, and assign a role (Admin, Member, or Viewer). They'll receive an invitation email.",
      },
      {
        q: "What are the different user roles?",
        a: "Owner has full control. Admin can manage members, settings, and all data. Member can create and edit most records. Viewer has read-only access across the platform.",
      },
    ],
  },
  {
    title: "Project Management",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    items: [
      {
        q: "How do I track task progress?",
        a: "Each task has a status (To Do, In Progress, In Review, Done). Update it from the task detail modal or drag tasks between columns in Board view.",
      },
      {
        q: "How do sprints work?",
        a: "Create a sprint under a project, assign tasks to it, and set start/end dates. The AI can also generate sprint plans for you — go to AI Assistant → Sprint Plans.",
      },
      {
        q: "How do I attach files to a task?",
        a: "Open any task detail modal and scroll to 'Attachments'. Click '+ Add File' to upload. Files are stored securely and accessible to anyone with task read access.",
      },
    ],
  },
  {
    title: "HR Management",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8.13a4 4 0 110 8 4 4 0 010-8zm6 8a4 4 0 100-8",
    items: [
      {
        q: "How do I check in for attendance?",
        a: "Use the clock icon in the top bar to check in and out. Your attendance history is visible at HR Management → Attendance.",
      },
      {
        q: "How do I request leave?",
        a: "Go to HR Management → Leave and click 'Request Leave'. Pick a leave type, date range, and submit. Your manager will be notified for approval.",
      },
      {
        q: "Can I see my own payslips?",
        a: "Payroll & Compensation is currently admin-only. Contact your HR administrator to view compensation details or download payslips.",
      },
    ],
  },
  {
    title: "CRM",
    icon: "M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12c1.598 0 2.978.8 3.6 1.964M12 8V6m0 2v8m0 0v2m0-2c-1.598 0-2.978-.8-3.6-1.964",
    items: [
      {
        q: "How do I convert a lead to an account?",
        a: "Open a lead's detail panel and click 'Convert to Account'. This creates an account, a contact, and optionally a deal — all in one step.",
      },
      {
        q: "How does the deal pipeline work?",
        a: "Deals move through stages: Prospecting → Discovery → Proposal → Negotiation → Contract Sent → Won/Lost. Drag deals between columns in the Kanban view, or use the detail page actions.",
      },
      {
        q: "Where do I see sales forecasts?",
        a: "Go to CRM → Sales Forecasts. Forecasts are computed live from your deals based on stage, expected close date, and probability.",
      },
    ],
  },
  {
    title: "AI Features",
    icon: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z",
    items: [
      {
        q: "What can the AI do?",
        a: "The AI can generate project plans, draft documents (PRDs, SOPs, reports), score leads, assess deal risk, summarize reviews, suggest sprint plans, and answer questions about your workspace data.",
      },
      {
        q: "Are AI suggestions automatically applied?",
        a: "No. All AI outputs show a 'provisional/AI-generated' banner and require human review. Sprint plans need explicit approval before creating real sprints and tasks.",
      },
      {
        q: "How do I use Ask AI?",
        a: "Click 'Ask AI' in the top bar or go to AI Assistant → Ask AI. Type a question about your projects, team, or data and get contextual answers.",
      },
    ],
  },
  {
    title: "Integrations",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    items: [
      {
        q: "Which integrations are available?",
        a: "Currently: ClickUp (tasks, docs, and chat), Gmail (email), Google Meet (video conferencing), and Slack. Go to Administration → Integrations to connect them.",
      },
      {
        q: "How do I connect an integration?",
        a: "Go to Administration → Integrations, find the service card, and click 'Connect'. For Google services you'll go through OAuth. For ClickUp you'll enter a Personal API Token.",
      },
      {
        q: "Is my data secure with integrations?",
        a: "Integration tokens are stored server-side only and never exposed to the browser. All API calls go through your Centr8 OS backend, not directly from the client.",
      },
    ],
  },
];

function Accordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-3 text-left text-body font-medium text-neutral-900 hover:text-primary-700"
      >
        {item.q}
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="pb-3 text-small leading-relaxed text-neutral-600">{item.a}</p>}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-display font-semibold text-neutral-950">Help Center</h1>
        <p className="mt-1 text-body text-neutral-600">
          Everything you need to get the most out of Centr8 OS.
        </p>
      </div>

      {/* Keyboard shortcuts */}
      <section className="glass-card rounded-md p-5">
        <h2 className="text-h3 font-semibold text-neutral-900">Keyboard Shortcuts</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {KEYBOARD_SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-neutral-300 bg-neutral-100 px-1.5 font-mono text-caption text-neutral-700"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-caption text-neutral-600">{s.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ sections */}
      {FAQ_SECTIONS.map((section) => (
        <section key={section.title} className="glass-card rounded-md p-5">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
            </svg>
            <h2 className="text-h3 font-semibold text-neutral-900">{section.title}</h2>
          </div>
          <div className="mt-3">
            {section.items.map((item) => (
              <Accordion key={item.q} item={item} />
            ))}
          </div>
        </section>
      ))}

      {/* Contact */}
      <section className="glass-card rounded-md p-5">
        <h2 className="text-h3 font-semibold text-neutral-900">Need More Help?</h2>
        <p className="mt-2 text-small text-neutral-600">
          Can&apos;t find what you&apos;re looking for? Reach out to our team.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="mailto:support@centr8.io"
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-small font-medium text-white hover:bg-primary-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Support
          </a>
          <a
            href="/ai/ask"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-4 py-2 text-small font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
            </svg>
            Ask AI
          </a>
        </div>
      </section>
    </div>
  );
}

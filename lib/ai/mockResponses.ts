// Hand-written mock responses for the New Project wizard's AI touchpoints.
// Realistic enough to demo without a live LLM. Switch NEXT_PUBLIC_AI_PROVIDER
// to 'groq' or 'gemini' to route through the real agent pipeline instead.

export type MockContext = Record<string, unknown>;

export const mockResponses = {
  Writer: {
    project_description: (ctx: MockContext) => {
      const name = (ctx.name as string) || "this project";
      return `${name} delivers a focused, cross-functional workstream aligned to Q3 objectives. The team will ship an initial release, gather early user signal, and iterate on scope over a fixed timeline. Success is measured by adoption within the first 30 days post-launch.`;
    },
    project_brief: (ctx: MockContext) => {
      const name = (ctx.name as string) || "Untitled Project";
      return `# ${name} — Project Brief

## Summary
${name} is a time-boxed initiative to deliver measurable business value to the target segment within one quarter.

## Objectives
- Ship the first usable release within 6 weeks
- Validate the core hypothesis with 5+ design partners
- Establish a repeatable delivery cadence for follow-on work

## Scope
In-scope: core workflow, primary integrations, baseline analytics.
Out-of-scope: mobile-native experiences, third-party marketplace, self-serve billing.

## Milestones
1. Discovery complete — week 1
2. MVP feature-complete — week 4
3. Beta launch — week 6
4. GA — end of quarter

## Success metrics
- Weekly active teams: 25+ by end of quarter
- Time-to-value under 10 minutes for a new team
- < 2% error rate on the primary flow

## Risks
- Integration surface may expand beyond current estimates
- Design-partner availability during holiday weeks
- Dependency on an in-flight platform migration`;
    },
    deadline_summary: (ctx: MockContext) => {
      const items = (ctx.deadlines as { title: string; days: number; kind: string; sub: string }[]) || [];
      if (items.length === 0) return "Nothing coming up — no project end-dates or task due-dates set. Add due dates on active tasks so this view can flag what needs attention.";
      const urgent = items.filter((i) => i.days <= 2);
      const week = items.filter((i) => i.days > 2 && i.days <= 7);
      const lines: string[] = [];
      if (urgent.length) lines.push(`Next 48 hours: ${urgent.map((i) => i.title).join(", ")} — this is what needs eyes today.`);
      if (week.length) lines.push(`Rest of the week: ${week.length} more item${week.length === 1 ? "" : "s"} due, all still comfortable to hit.`);
      const beyond = items.filter((i) => i.days > 7);
      if (beyond.length) lines.push(`Also on the horizon: ${beyond.map((i) => `${i.title} (${new Date().toLocaleDateString()})`).slice(0, 2).join(", ")}.`);
      lines.push("Nothing looks overdue — the lightweight lift is confirming ownership on anything unassigned so nothing falls through.");
      return lines.join(" ");
    },
    portfolio_summary: (ctx: MockContext) => {
      const total = Number(ctx.total) || 0;
      const active = Number(ctx.active) || 0;
      const atRisk = Number(ctx.atRisk) || 0;
      const health = atRisk === 0 ? "healthy" : atRisk / Math.max(total, 1) < 0.25 ? "mostly on track" : "under pressure";
      return `Portfolio is ${health}: ${active} of ${total} projects are actively delivering, and ${atRisk} carry at least one overdue or blocked task. The best next move is a 15-minute unblock pass on the at-risk items — most slippages here typically resolve with a single reassignment or a scope trim rather than a full replan.`;
    },
    kickoff_notes: (ctx: MockContext) => {
      const name = (ctx.name as string) || "the project";
      return `Kick-off agenda for ${name}:

1. Team intros and role clarity (10 min)
2. Walk through the project brief and success metrics (15 min)
3. Confirm timeline milestones and dependencies (15 min)
4. Communication cadence — weekly standup + async Slack updates (5 min)
5. Open questions and blockers (10 min)

Follow-ups:
- Share the shared drive folder link in Slack after the call
- First status update due end-of-week Friday
- Retro after milestone 1 lands`;
    },
  },
  Analyst: {
    suggest_priority: (ctx: MockContext) => {
      const hasEndDate = Boolean(ctx.endDate);
      return {
        priority: hasEndDate ? "High" : "Medium",
        reasoning: hasEndDate
          ? "Fixed end date and a short lead time typically warrants high priority to keep buffers realistic."
          : "No fixed deadline yet — starting at medium so it can rise once the timeline firms up.",
      };
    },
    suggest_tags: (ctx: MockContext) => {
      const name = ((ctx.name as string) || "").toLowerCase();
      const tags = ["q3-2026", "cross-functional"];
      if (name.includes("launch") || name.includes("release")) tags.push("gtm");
      if (name.includes("data") || name.includes("analytics")) tags.push("data-platform");
      if (name.includes("mobile")) tags.push("mobile");
      tags.push("client-facing");
      return {
        tags,
        reasoning: "Inferred from the project name plus current quarter defaults. Removing tags is fine — they're a lightweight grouping signal, not a workflow gate.",
      };
    },
    estimate_budget: (ctx: MockContext) => {
      const duration = Number(ctx.durationWeeks) || 12;
      const perWeek = 8500;
      const low = Math.round(duration * perWeek * 0.85);
      const high = Math.round(duration * perWeek * 1.2);
      return {
        amount_low: low,
        amount_high: high,
        currency: (ctx.currency as string) || "INR",
        reasoning: `Based on a typical ~${perWeek.toLocaleString()}/week fully-loaded cost for a 4-person cross-functional squad, adjusted ±20% for scope uncertainty. Recheck once team composition is confirmed.`,
      };
    },
    ask: (ctx: MockContext) => {
      const q = ((ctx.question as string) || "").toLowerCase();
      if (q.includes("overdue") || q.includes("late")) {
        return "Two tasks are overdue this week — both on the Website relaunch project, both unassigned. Reassigning them to the project lead typically clears the backlog within 48 hours.";
      }
      if (q.includes("budget") || q.includes("spend")) {
        return "Portfolio is on-budget: Demo Project has burned 25% of its allocated ₹50,000 with 20% of tasks done, so on track. No projects are in overspend territory yet.";
      }
      if (q.includes("who") || q.includes("team")) {
        return "The most common gap right now is unassigned tasks — 4 across active projects. Once ownership is set, the delivery forecast tightens by roughly a week per project.";
      }
      return "Nothing jumps out as urgent — the portfolio is small enough that a quick scan of the Projects page will show you everything material. Ask me about a specific project, budget, or team member for a sharper read.";
    },
    recommend_members_for_role: (ctx: MockContext) => {
      const role = ((ctx.role as string) || "team member").toLowerCase();
      const pool: Record<string, { name: string; reason: string }[]> = {
        developer: [
          { name: "Aditi Rao", reason: "Shipped 3 web apps this year; low current load." },
          { name: "Marco Silva", reason: "React specialist; open capacity for 20 hrs/wk." },
          { name: "Priya Nair", reason: "Just wrapped Q2 project; strong TypeScript track record." },
        ],
        designer: [
          { name: "Jules Novak", reason: "Recent brand refresh; product design background." },
          { name: "Chen Wu", reason: "Available half-time; strong at design systems." },
          { name: "Hannah Ford", reason: "Prior work on similar client project." },
        ],
        "project manager": [
          { name: "Ravi Kapoor", reason: "PM'd two active projects that finished on time." },
          { name: "Sofía Lima", reason: "Client-facing PM with recent case-study wins." },
          { name: "Naomi Fields", reason: "Delivery-focused PM; strong at unblocking." },
        ],
        qa: [
          { name: "Devon Park", reason: "Automation-first QA; owns the current test harness." },
          { name: "Larissa Meyer", reason: "Available full-time; specializes in regression suites." },
          { name: "Omar Haddad", reason: "Manual + exploratory testing background." },
        ],
        devops: [
          { name: "Kai Lin", reason: "Owns current CI/CD; already knows the stack." },
          { name: "Elena Roth", reason: "Just certified in the target cloud." },
          { name: "Yusuf Adebayo", reason: "K8s + Terraform specialist." },
        ],
        marketing: [
          { name: "Riya Bhatt", reason: "Ran the last campaign that hit 2x targets." },
          { name: "Alex Wren", reason: "Positioning + copy specialist." },
          { name: "Jordan Lee", reason: "Available for content + community." },
        ],
        sales: [
          { name: "Nadia Costa", reason: "Owns the enterprise book; strong closer." },
          { name: "Ben Okafor", reason: "SMB pipeline; fast at qualifying leads." },
          { name: "Sana Ali", reason: "Just moved off a wrapped account." },
        ],
      };
      const list = pool[role] ?? [
        { name: "Team member A", reason: "Available and generally strong." },
        { name: "Team member B", reason: "Recent related work." },
        { name: "Team member C", reason: "Open capacity right now." },
      ];
      return list;
    },
    suggest_budget_breakdown: (ctx: MockContext) => {
      const total = Number(ctx.allocatedBudget) || 100000;
      return {
        labor: Math.round(total * 0.65),
        software: Math.round(total * 0.1),
        services: Math.round(total * 0.15),
        other: Math.round(total * 0.1),
        reasoning: "Labor-heavy split typical for a build project. If you're leaning on outside vendors, shift 5-10% from Labor into Services.",
      };
    },
  },
  Planner: {
    suggest_timeline: (ctx: MockContext) => {
      const now = new Date((ctx.today as string) || "2026-07-24");
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 84);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        start_date: iso(start),
        end_date: iso(end),
        reasoning: "One-week runway to kick off, then a 12-week delivery window matching your typical squad velocity. Adjust down if the scope is tighter than the brief implies.",
      };
    },
    suggest_team_composition: (_ctx: MockContext) => [
      { role: "Project Manager", count: 1 },
      { role: "Developer", count: 2 },
      { role: "Designer", count: 1 },
      { role: "QA", count: 1 },
    ],
  },
} as const;

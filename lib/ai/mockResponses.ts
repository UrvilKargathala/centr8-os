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
      { role: "Project Lead", count: 1 },
      { role: "Engineer", count: 2 },
      { role: "Designer", count: 1 },
      { role: "PM / Analyst", count: 1 },
    ],
  },
} as const;

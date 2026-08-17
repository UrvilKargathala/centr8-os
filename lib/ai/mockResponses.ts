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
    draft_slack_reply: (ctx: MockContext) => {
      const preview = (ctx.preview as string) || "";
      const low = preview.toLowerCase();
      if (low.includes("push") || low.includes("thursday")) return "Thursday works — I've updated the calendar. Same 2pm start?";
      if (low.includes("pr") || low.includes("merged")) return "Nice — I'll take a look this afternoon and sign off if it's clean.";
      if (low.includes("hero") || low.includes("design") || low.includes("figma")) return "Really like the softer gradient. One small note — CTA could use a touch more breathing room.";
      return "Thanks — I'll take a look and follow up shortly.";
    },
    draft_task_comment_reply: (ctx: MockContext) => {
      const comments = (ctx.comments as { text: string }[]) || [];
      const last = comments[comments.length - 1]?.text.toLowerCase() ?? "";
      if (last.includes("blocked") || last.includes("waiting")) return "Thanks for the flag — let me know what's blocking this and I'll help clear it today.";
      if (last.includes("done") || last.includes("shipped") || last.includes("merged")) return "Nice work — closing this out. Let me know if there's follow-up needed.";
      if (last.includes("question") || last.includes("?")) return "Good question — let me check and get back to you shortly.";
      return "Thanks for the update — I'll take a look and follow up here.";
    },
    // Video Conferencing (Google Meet) has no transcript/recording data —
    // this replaces the old transcript-based "Summarize meeting" touchpoint
    // with something that works from what a calendar event actually has:
    // title + attendees, generating a fill-in-yourself template rather than
    // fabricating notes for a meeting that hasn't happened yet (or that we
    // have no record of the content of).
    draft_meeting_notes_template: (ctx: MockContext) => {
      const title = (ctx.title as string) || "Meeting";
      const attendees = (ctx.attendees as string[]) || [];
      const attendeeLine = attendees.length > 0 ? attendees.join(", ") : "(add attendees)";
      return `# ${title}\n\n**Date:** ${new Date().toLocaleDateString()}\n**Attendees:** ${attendeeLine}\n\n## Agenda\n- \n- \n\n## Discussion notes\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] Owner — task — due date\n`;
    },
    draft_email_reply: (ctx: MockContext) => {
      const subject = (ctx.subject as string) || "";
      if (subject.toLowerCase().includes("sprint")) {
        return {
          subject: `Re: ${subject}`,
          body: `Hi Sarah,\n\nThursday at 2pm works on our end — I've updated our internal calendar. We'll come with the sprint 3 delta plus a quick preview of what's landing in sprint 4.\n\nSee you then,\nUrvil`,
        };
      }
      if (subject.toLowerCase().includes("proposal") || subject.toLowerCase().includes("sow")) {
        return {
          subject: `Re: ${subject}`,
          body: `Hi Diana,\n\nThanks for sending this over so quickly. Terms look good on my side. Let me get one more read from the team and I'll come back tomorrow with a signed version.\n\nBest,\nUrvil`,
        };
      }
      return {
        subject: `Re: ${subject}`,
        body: `Thanks for reaching out — I'll reply properly shortly with the detail you asked for.\n\nBest,\nUrvil`,
      };
    },
    summarize_call: (ctx: MockContext) => {
      const name = (ctx.participant as string) || "the caller";
      const notes = (ctx.notes as string) || "";
      return {
        summary: notes || `Short call with ${name}. Covered current status and next steps.`,
        action_items: ["Follow up with a written recap by end of day", "Add next milestone to the shared plan", "Schedule the follow-up for next week"],
      };
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
    // HR Batch 3 — /hr/reviews My Reviews tab, self-assessment form.
    draft_self_assessment: (ctx: MockContext) => {
      const name = (ctx.name as string) || "I";
      const cycle = (ctx.cycle_name as string) || "this cycle";
      return {
        strengths: `${name} stayed reliable on delivery this ${cycle}, consistently meeting sprint commitments and helping unblock teammates when scope shifted.`,
        areas_for_growth: "Could be more proactive flagging risks earlier rather than absorbing them silently — worth calling out blockers sooner next cycle.",
        achievements: "Shipped the main deliverables on schedule and picked up extra scope when a teammate was out.",
        goals_next_period: "Take ownership of one cross-team initiative and mentor a newer team member.",
      };
    },
    // HR Batch 3 — /hr/recruitment job posting creation.
    draft_job_posting: (ctx: MockContext) => {
      const title = (ctx.title as string) || "this role";
      const dept = (ctx.department as string) || "the team";
      return {
        description: `We're hiring a ${title} to join ${dept}. You'll work closely with cross-functional partners to ship high-quality work on a fast-moving team, owning problems end-to-end rather than just executing tickets.`,
        requirements: `- Proven experience in a similar ${title} role\n- Strong communication and ownership mindset\n- Comfortable working in a fast-paced, ambiguous environment\n- Bonus: prior experience in a startup or scale-up setting`,
      };
    },
    // HR Batch 4 — /hr/training course-authoring form (admin only).
    generate_course_outline: (ctx: MockContext) => {
      const title = (ctx.title as string) || "this course";
      const low = title.toLowerCase();
      const category = low.includes("security") || low.includes("compliance") || low.includes("policy")
        ? "Compliance"
        : low.includes("lead") || low.includes("manage")
        ? "Leadership"
        : low.includes("code") || low.includes("engineer") || low.includes("technical")
        ? "Technical"
        : "Soft Skills";
      return {
        description: `${title} gives employees a practical grounding in the topic, with real scenarios rather than pure theory, so it's immediately usable on the job.`,
        category,
        duration_minutes: category === "Compliance" ? 30 : 45,
      };
    },
    // CRM Batch 1 — /crm/contacts contact detail, "Draft follow-up email".
    draft_crm_email: (ctx: MockContext) => {
      const name = ((ctx.name as string) || "there").split(" ")[0];
      const recentActivity = (ctx.recent_activity_summary as string) || "";
      return {
        subject: "Following up",
        body: `Hi ${name},\n\n${recentActivity ? `Following up after ${recentActivity} — ` : "Wanted to follow up — "}wanted to check in and see where things stand on your end. Happy to jump on a quick call this week if useful.\n\nLet me know what works.\n\nBest,\nUrvil`,
        reasoning: "Short, low-pressure follow-up template — tighten with specifics from your last conversation before sending.",
      };
    },
    // CRM Batch 2 — /crm/deals/[id] AI Insights, "Draft proposal email".
    draft_deal_proposal: (ctx: MockContext) => {
      const dealName = (ctx.deal_name as string) || "this deal";
      const contactName = ((ctx.contact_name as string) || "there").split(" ")[0];
      const value = ctx.value as number | undefined;
      const currency = (ctx.currency as string) || "INR";
      return {
        subject: `Proposal — ${dealName}`,
        body: `Hi ${contactName},\n\nThanks for the conversations so far — here's a quick recap of what we discussed for ${dealName}${value ? ` (${currency} ${value.toLocaleString()})` : ""}.\n\nNext steps on our end: finalize scope and send over the formal proposal document. Let me know if you'd like to walk through anything before then.\n\nLooking forward to moving this ahead.\n\nBest,\nUrvil`,
        reasoning: "Recap-and-next-steps template — fill in specific scope details before sending.",
      };
    },
    // CRM Batch 3 — /crm/campaigns/[id] AI Insights, "Draft campaign copy".
    draft_campaign_copy: (ctx: MockContext) => {
      const type = ((ctx.type as string) || "email").toLowerCase();
      const audience = (ctx.target_audience as string) || "your target audience";
      const description = (ctx.description as string) || "our product";
      if (type === "social" || type === "paid_ads") {
        return {
          subject: null,
          body: `Struggling with the problem ${description} solves? You're not alone. Built for ${audience} — see why teams are switching. Learn more →`,
          channel_note: "Short-form copy for social/ad placements — pair with a strong visual and a single clear CTA.",
          reasoning: "Ad copy needs to hook fast — this leads with the pain point, not the feature list.",
        };
      }
      return {
        subject: `A better way to handle this, ${audience}`,
        body: `Hi there,\n\nWe built ${description} specifically with ${audience} in mind. If you're dealing with the usual friction, this might help.\n\nWorth a 15-minute look? Happy to walk through it whenever suits.\n\nBest,\nThe team`,
        channel_note: "Standard cold-outreach email template — personalize the opener before sending.",
        reasoning: `Tailored for ${type} — direct, low-pressure ask with a clear next step.`,
      };
    },
    // AI Assistant — /ai/documents "+ Generate Document". One distinct
    // markdown template per doc_type so a demo doesn't read as the same
    // content wearing eight different headings.
    generate_document: (ctx: MockContext) => {
      const docType = (ctx.doc_type as string) || "prd";
      const projectName = (ctx.project_name as string) || "the project";
      const context = (ctx.context as string) || "";
      const contextNote = context ? `\n\n> Additional context: ${context}` : "";
      const today = (ctx.today as string) || "2026-07-31";

      const templates: Record<string, () => { title: string; content: string }> = {
        prd: () => ({
          title: `${projectName} — Product Requirements Document`,
          content: `# ${projectName} — PRD${contextNote}\n\n## Summary\n${projectName} addresses a clear gap for its target users by shipping a focused first release rather than a broad feature set. This document defines scope, success criteria, and what is explicitly out of bounds for v1.\n\n## Problem statement\nUsers currently rely on manual or fragmented workarounds. The cost shows up as lost time, inconsistent output, and reduced trust in the process.\n\n## Goals\n- Ship a working v1 within the current quarter\n- Validate the core workflow with real usage, not just internal review\n- Keep the surface area small enough to iterate weekly\n\n## Non-goals\n- Full feature parity with adjacent tools\n- Enterprise-only configuration options\n- Anything requiring a new paid infrastructure dependency\n\n## User stories\n1. As a user, I want to complete the core task in under two minutes so that I don't abandon the flow.\n2. As an admin, I want visibility into who did what so that I can audit activity later.\n3. As a stakeholder, I want a clear signal of progress so that I don't need to ask for status updates.\n\n## Success metrics\n- Adoption: 60%+ of the target audience uses the feature within 30 days of launch\n- Quality: fewer than 3 critical bugs reported in the first two weeks\n- Satisfaction: qualitative feedback trends positive in the first round of check-ins\n\n## Open questions\n- Final rollout sequencing (all-at-once vs. phased)\n- Whether a settings/config surface is needed for v1 or can wait\n\n*Generated ${today} — provisional, review before treating as final scope.*`,
        }),
        sop: () => ({
          title: `${projectName} — Standard Operating Procedure`,
          content: `# ${projectName} — SOP${contextNote}\n\n## Purpose\nThis procedure standardizes how this workflow is carried out so outcomes stay consistent regardless of who runs it.\n\n## Scope\nApplies to anyone responsible for executing or reviewing this process within the team.\n\n## Prerequisites\n- Access to the relevant system/tool\n- Familiarity with the underlying data or request format\n\n## Procedure\n1. Confirm the request meets the intake criteria before starting.\n2. Gather the required inputs and verify they're current.\n3. Execute the core steps in order — do not skip validation checks.\n4. Record the outcome in the shared log for traceability.\n5. Flag any exception immediately rather than working around it silently.\n\n## Exceptions\nIf a step cannot be completed as written, stop and escalate rather than improvising — note the blocker in the log so the SOP itself can be corrected if it's genuinely wrong.\n\n## Review cadence\nThis SOP should be reviewed each quarter, or immediately after any incident traced back to this process.\n\n*Generated ${today} — provisional, review before treating as the source of truth.*`,
        }),
        meeting_summary: () => ({
          title: `${projectName} — Meeting Summary`,
          content: `# ${projectName} — Meeting Summary${contextNote}\n\n**Date:** ${today}\n\n## Attendees\nCore team members present; notes reflect the discussion as captured.\n\n## Discussion points\n- Reviewed current progress against the plan; broadly on track with a couple of open risks.\n- Discussed the highest-priority blocker and agreed an owner to chase it down this week.\n- Raised a scope question that needs a decision before the next milestone.\n\n## Decisions made\n- Proceed with the current approach; revisit only if the open risk materializes.\n- Owner assigned for the blocker with a follow-up checkpoint.\n\n## Action items\n1. Follow up on the blocked item and report back by end of week.\n2. Get a decision on the open scope question before next sync.\n3. Update the shared plan to reflect any changes agreed today.\n\n## Next meeting\nStandard cadence continues; ad-hoc sync if the blocker isn't cleared in time.\n\n*Generated ${today} — provisional, review before circulating.*`,
        }),
        release_notes: () => ({
          title: `${projectName} — Release Notes`,
          content: `# ${projectName} — Release Notes${contextNote}\n\n**Release date:** ${today}\n\n## What's new\n- Shipped the core workflow end to end, covering the primary use case identified in planning.\n- Added supporting UI so the feature is discoverable without documentation.\n\n## Improvements\n- Tightened the flow based on internal testing feedback ahead of release.\n- Cleaned up rough edges in error handling so failures surface clearly instead of failing silently.\n\n## Fixes\n- Resolved edge cases found during QA that could otherwise cause inconsistent state.\n\n## Known issues\n- A small number of edge cases remain open and are tracked for a follow-up release.\n\n## Upgrade notes\nNo action required — this release is backward compatible with existing data.\n\n*Generated ${today} — provisional, review before publishing externally.*`,
        }),
        bug_report: () => ({
          title: `${projectName} — Bug Report`,
          content: `# ${projectName} — Bug Report${contextNote}\n\n## Summary\nA reproducible defect was identified affecting the core workflow under specific conditions.\n\n## Environment\n- Production / current release\n- Affects the primary user-facing flow\n\n## Steps to reproduce\n1. Start from the relevant screen in a clean state.\n2. Perform the action that triggers the defect.\n3. Observe the incorrect behavior instead of the expected result.\n\n## Expected behavior\nThe action should complete and reflect the correct state without requiring a workaround.\n\n## Actual behavior\nThe action either fails silently, produces an incorrect result, or leaves the system in an inconsistent state.\n\n## Severity\nMedium — affects a real user path but has a known workaround in the meantime.\n\n## Suggested next step\nAssign to the owning area for triage and reproduction confirmation before scheduling a fix.\n\n*Generated ${today} — provisional, verify repro before filing upstream.*`,
        }),
        test_cases: () => ({
          title: `${projectName} — Test Cases`,
          content: `# ${projectName} — Test Cases${contextNote}\n\n## Scope\nCovers the primary happy path plus the most likely edge cases for this feature.\n\n## Test case 1 — Happy path\n**Steps:** Complete the flow with valid inputs.\n**Expected:** Flow completes successfully and the result is visible immediately.\n\n## Test case 2 — Missing required input\n**Steps:** Attempt to complete the flow with a required field left blank.\n**Expected:** A clear validation error is shown; nothing is submitted.\n\n## Test case 3 — Permission boundary\n**Steps:** Attempt the action as a role that should not have access.\n**Expected:** Action is blocked server-side, not just hidden in the UI.\n\n## Test case 4 — Concurrent edit\n**Steps:** Two users attempt to modify the same record at once.\n**Expected:** The system resolves the conflict predictably rather than silently dropping one change.\n\n## Test case 5 — Empty state\n**Steps:** Load the feature with no existing data.\n**Expected:** A clear empty state is shown, not a blank or broken screen.\n\n*Generated ${today} — provisional, expand with real edge cases before sign-off.*`,
        }),
        client_update: () => ({
          title: `${projectName} — Client Update`,
          content: `# ${projectName} — Status Update${contextNote}\n\nHi team,\n\nHere's where things stand on ${projectName} as of ${today}.\n\n## Progress\nWork is proceeding on schedule against the agreed plan. The core functionality is in place and moving through internal review.\n\n## What's next\nWe're focused on final polish and validation before the next milestone. No changes to the agreed timeline at this stage.\n\n## Anything we need from you\nNothing urgent right now — we'll flag directly if that changes.\n\nHappy to jump on a call if useful, otherwise the next update will land at the usual cadence.\n\nBest,\nThe team\n\n*Generated ${today} — provisional, review tone and specifics before sending.*`,
        }),
        executive_summary: () => ({
          title: `${projectName} — Executive Summary`,
          content: `# ${projectName} — Executive Summary${contextNote}\n\n## Overview\n${projectName} is progressing against plan, with the core delivery on track and no unresolved blockers requiring executive attention at this time.\n\n## Key metrics\n- Delivery: on schedule against the current milestone\n- Risk: low — no unresolved critical blockers\n- Team health: capacity is within normal range\n\n## Highlights\n- Core workstream reached its planned checkpoint this period.\n- No budget or timeline overruns to report.\n\n## Risks to watch\n- Standard execution risk; nothing elevated beyond normal delivery variance.\n\n## Recommendation\nContinue as planned — no executive intervention needed this cycle. Revisit if a material change in scope or timeline emerges.\n\n*Generated ${today} — provisional, verify figures before board/exec circulation.*`,
        }),
      };

      const build = templates[docType] ?? templates.prd;
      return build();
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
    // AI Assistant — /ai/ask full conversation flow. Richer than the older
    // `ask` above: returns citations and reads conversation_history so a
    // follow-up ("what about the second one?") lands on-topic.
    ask_ai: (ctx: MockContext) => {
      const q = ((ctx.question as string) || "").toLowerCase();
      const history = (ctx.conversation_history as { role: string; content: string }[]) || [];
      const isFollowUp = history.length > 0;
      const followUpPrefix = isFollowUp ? "Following up on that — " : "";

      // Small-talk gets a small-talk answer instead of falling through to
      // the "nothing specific jumps out" catch-all, which read as broken
      // when someone just said hi.
      if (/^(hi|hello|hey|yo|sup)\b/.test(q.trim())) {
        return { answer: "Hi! I can help with anything in this workspace — overdue work, at-risk projects, team capacity, budgets, or your CRM pipeline. What would you like to know?", citations: [] };
      }
      if (q.includes("good morning")) {
        return { answer: "Good morning! Here to help — ask me about overdue work, at-risk projects, team capacity, or anything else in the workspace.", citations: [] };
      }
      if (q.includes("good night") || q.includes("goodnight")) {
        return { answer: "Good night! Nothing urgent needs your attention right now that I can see — feel free to pick this back up tomorrow.", citations: [] };
      }
      if (q.includes("good afternoon") || q.includes("good evening")) {
        return { answer: "Hello! Let me know if you'd like a read on overdue work, at-risk projects, team capacity, or budgets.", citations: [] };
      }
      if (q.includes("how are you")) {
        return { answer: "Doing well, thanks for asking! Ready whenever you want a read on the workspace — overdue work, at-risk projects, or team capacity.", citations: [] };
      }
      if (/^(thanks|thank you|thx|ty)\b/.test(q.trim())) {
        return { answer: "Anytime — let me know if anything else comes up.", citations: [] };
      }
      if (/^(bye|goodbye|see ya|see you)\b/.test(q.trim())) {
        return { answer: "See you! I'll be here whenever you need a read on the workspace.", citations: [] };
      }

      if (q.includes("overdue") || q.includes("late")) {
        return {
          answer: `${followUpPrefix}**Two tasks are overdue** this week, both on the **Website relaunch** project and both unassigned. Reassigning them to the project lead typically clears the backlog within **48 hours**.`,
          citations: [
            { source_type: "project", source_title: "Website relaunch", excerpt: "2 overdue tasks, both unassigned." },
            { source_type: "task", source_title: "Update hero copy", excerpt: "Due 3 days ago, no assignee." },
          ],
        };
      }
      if (q.includes("risk") || q.includes("at risk")) {
        return {
          answer: `${followUpPrefix}**Demo Project** is the one to watch — it has **2 blocked tasks** and no health scan in the last week. Everything else in the portfolio looks **on track**.`,
          citations: [{ source_type: "project", source_title: "Demo Project", excerpt: "2 blocked tasks, last health scan 8 days ago." }],
        };
      }
      if (q.includes("overload") || q.includes("capacity") || q.includes("who")) {
        return {
          answer: `${followUpPrefix}**One person is over-allocated** this sprint — assigned roughly **46 hours** of estimated work against a **40-hour week**. Everyone else is under **90% utilization**.`,
          citations: [{ source_type: "employee", source_title: "Team capacity", excerpt: "46h assigned vs 40h/week available." }],
        };
      }
      if (q.includes("budget") || q.includes("spend")) {
        return {
          answer: `${followUpPrefix}Portfolio is **on-budget** overall: Demo Project has burned about **25%** of its allocated budget against **20%** of tasks complete, so pacing is roughly in line.`,
          citations: [{ source_type: "project", source_title: "Demo Project", excerpt: "25% of budget spent, 20% of tasks done." }],
        };
      }
      if (q.includes("decision") || q.includes("decided") || q.includes("why")) {
        return {
          answer: `${followUpPrefix}The most recent recorded decision was to scope the **Website relaunch** to a **single-phase launch** rather than splitting it — noted to keep the timeline inside this quarter.`,
          citations: [{ source_type: "decision_log", source_title: "Website relaunch scope call", excerpt: "Single-phase launch chosen over phased rollout." }],
        };
      }
      if (q.includes("meeting") || q.includes("standup") || q.includes("sync")) {
        return {
          answer: `${followUpPrefix}The most recent **sprint review** covered progress on the current sprint's top-priority tasks and flagged **one dependency** waiting on design assets.`,
          citations: [{ source_type: "meeting_note", source_title: "Sprint review", excerpt: "One task blocked pending design assets." }],
        };
      }
      if (q.includes("skill") || q.includes("who knows") || q.includes("expert")) {
        return {
          answer: `${followUpPrefix}A few people on the team have **frontend** and **design-system** experience listed on their profile — worth checking the **Team Directory**'s skill tags for the closest match to what you need.`,
          citations: [{ source_type: "employee", source_title: "Team Directory", excerpt: "Skill tags recorded per person." }],
        };
      }
      if (q.includes("deal") || q.includes("pipeline") || q.includes("crm")) {
        return {
          answer: `${followUpPrefix}Pipeline is **healthy** — most open deals are in early stages with **no deals stalled** past two weeks in the same stage right now.`,
          citations: [{ source_type: "project", source_title: "CRM Pipeline", excerpt: "No deals stale >14 days in current stage." }],
        };
      }
      if (q.includes("leave") || q.includes("attendance") || q.includes("hr")) {
        return {
          answer: `${followUpPrefix}There's **nothing unusual** in attendance right now — no flagged anomalies, and any pending leave requests are visible on the **Leave Management** approvals tab.`,
          citations: [{ source_type: "employee", source_title: "Attendance & Leave", excerpt: "No anomalies flagged this period." }],
        };
      }
      return {
        answer: `${followUpPrefix}Nothing specific jumps out for that — try asking about **overdue work**, **at-risk projects**, **team capacity**, **budgets**, or **CRM pipeline** for a sharper answer.`,
        citations: [],
      };
    },
    // AI Assistant — Executive dashboard + /ai/recommendations.
    generate_recommendations: (ctx: MockContext) => {
      const overdueTasks = Number(ctx.overdue_tasks_count) || 0;
      const overAllocated = (ctx.over_allocated_members as string[]) || [];
      const atRiskDeals = (ctx.at_risk_deal_names as string[]) || [];
      const pendingLeave = Number(ctx.pending_leave_requests) || 0;
      const pendingPlans = Number(ctx.pending_sprint_plans) || 0;
      const projectNames = (ctx.at_risk_project_names as string[]) || [];

      const recs: Array<{
        id: string;
        priority: "critical" | "high" | "medium";
        title: string;
        description: string;
        category: "project" | "hr" | "crm" | "capacity";
        action_type: "review" | "approve" | "investigate" | "reassign";
        linked_entity_type?: string;
        linked_entity_id?: string;
        reasoning: string;
      }> = [];

      if (overdueTasks > 0) {
        recs.push({
          id: "overdue-tasks",
          priority: overdueTasks > 3 ? "critical" : "high",
          title: `${overdueTasks} task${overdueTasks === 1 ? "" : "s"} overdue`,
          description: "Unassigned or stalled tasks are pushing past their due dates across active projects.",
          category: "project",
          action_type: "review",
          linked_entity_type: "tasks",
          reasoning: "Overdue tasks compound — the longer they sit, the more they push downstream dependencies.",
        });
      }
      for (const name of projectNames.slice(0, 2)) {
        recs.push({
          id: `project-risk-${name}`,
          priority: "high",
          title: `${name} shows risk signals`,
          description: "Blocked tasks or a stale health scan suggest this project needs a closer look this week.",
          category: "project",
          action_type: "investigate",
          linked_entity_type: "project",
          reasoning: "Projects with blocked work and no recent health scan are the most common source of missed deadlines.",
        });
      }
      for (const name of overAllocated.slice(0, 2)) {
        recs.push({
          id: `capacity-${name}`,
          priority: "medium",
          title: `${name} is over-allocated`,
          description: "Assigned estimated hours exceed their available capacity for the current sprint.",
          category: "capacity",
          action_type: "reassign",
          linked_entity_type: "employee",
          reasoning: "Sustained over-allocation is a leading indicator of missed sprint commitments and burnout risk.",
        });
      }
      for (const name of atRiskDeals.slice(0, 2)) {
        recs.push({
          id: `deal-${name}`,
          priority: "medium",
          title: `${name} deal has gone stale`,
          description: "No stage movement or logged activity in over two weeks.",
          category: "crm",
          action_type: "investigate",
          linked_entity_type: "deal",
          reasoning: "Deals stalled this long rarely self-recover without a direct follow-up.",
        });
      }
      if (pendingLeave > 0) {
        recs.push({
          id: "pending-leave",
          priority: "medium",
          title: `${pendingLeave} leave request${pendingLeave === 1 ? "" : "s"} awaiting approval`,
          description: "Pending leave requests sitting past a few days can affect the requester's planning.",
          category: "hr",
          action_type: "approve",
          linked_entity_type: "leave",
          reasoning: "Leave requests are time-sensitive by nature — delayed approval is a common source of employee friction.",
        });
      }
      if (pendingPlans > 0) {
        recs.push({
          id: "pending-sprint-plans",
          priority: "high",
          title: `${pendingPlans} sprint plan${pendingPlans === 1 ? "" : "s"} awaiting approval`,
          description: "AI-proposed sprint plans are queued for review — approving unblocks the next sprint's kickoff.",
          category: "project",
          action_type: "approve",
          linked_entity_type: "sprint_plan",
          reasoning: "An unapproved plan blocks the whole team from starting the next sprint on schedule.",
        });
      }
      if (recs.length === 0) {
        recs.push({
          id: "all-clear",
          priority: "medium",
          title: "No urgent items right now",
          description: "Projects, capacity, and pipeline all look healthy based on current data.",
          category: "project",
          action_type: "review",
          reasoning: "No overdue tasks, over-allocated people, stale deals, or pending approvals were found.",
        });
      }
      return { recommendations: recs.slice(0, 8) };
    },
    // Global dashboard (/dashboard) — "AI: Daily Briefing".
    daily_briefing: (ctx: MockContext) => {
      const d = (ctx.dashboard_data as Record<string, unknown>) || {};
      const tasks = (d.tasks as { overdue?: number; in_progress?: number }) || {};
      const projects = (d.projects as { active?: number; at_risk?: number }) || {};
      const deals = (d.deals as { weighted_pipeline_value?: number; deals_to_close_this_month?: number } | null) || null;
      const attendance = (d.attendance as { attendance_rate_percent?: number | null } | null) || null;
      const leave = (d.leave as { on_leave_today?: number | null } | null) || null;
      const openHrCases = d.open_hr_cases as number | null | undefined;
      const ai = (d.ai as { pending_sprint_plans?: number | null; documents_in_draft?: number | null }) || {};

      const highlights: { type: "positive" | "warning" | "action_needed"; text: string }[] = [];
      const sentences: string[] = [];

      const overdue = tasks.overdue ?? 0;
      const atRisk = projects.at_risk ?? 0;
      if (overdue > 0) {
        sentences.push(`You have ${overdue} overdue task${overdue === 1 ? "" : "s"}${atRisk > 0 ? ` across ${atRisk} at-risk project${atRisk === 1 ? "" : "s"}` : ""}.`);
        highlights.push({ type: "action_needed", text: `${overdue} overdue task${overdue === 1 ? "" : "s"} need${overdue === 1 ? "s" : ""} attention` });
      } else {
        sentences.push("No overdue tasks right now — project work is on pace.");
        highlights.push({ type: "positive", text: "No overdue tasks" });
      }

      if (deals) {
        const weighted = (deals.weighted_pipeline_value ?? 0).toLocaleString();
        const closing = deals.deals_to_close_this_month ?? 0;
        sentences.push(`Pipeline is ₹${weighted} weighted${closing > 0 ? `, with ${closing} deal${closing === 1 ? "" : "s"} expected to close this month` : ""}.`);
        if (closing > 0) highlights.push({ type: "positive", text: `${closing} deal${closing === 1 ? "" : "s"} closing this month` });
      }

      if (attendance && attendance.attendance_rate_percent !== null && attendance.attendance_rate_percent !== undefined) {
        const onLeave = leave?.on_leave_today ?? 0;
        sentences.push(`${onLeave > 0 ? `${onLeave} team member${onLeave === 1 ? "" : "s"} ${onLeave === 1 ? "is" : "are"} on leave today, ` : ""}attendance rate is ${attendance.attendance_rate_percent}%.`);
        if (attendance.attendance_rate_percent < 70) highlights.push({ type: "warning", text: `Attendance is low today (${attendance.attendance_rate_percent}%)` });
      }

      if (typeof openHrCases === "number" && openHrCases > 0) {
        sentences.push(`${openHrCases} HR case${openHrCases === 1 ? "" : "s"} ${openHrCases === 1 ? "is" : "are"} open.`);
        highlights.push({ type: "warning", text: `${openHrCases} open HR case${openHrCases === 1 ? "" : "s"}` });
      }

      const pendingPlans = ai.pending_sprint_plans ?? 0;
      const draftDocs = ai.documents_in_draft ?? 0;
      if (pendingPlans > 0) highlights.push({ type: "action_needed", text: `${pendingPlans} sprint plan${pendingPlans === 1 ? "" : "s"} awaiting approval` });
      if (draftDocs > 0) highlights.push({ type: "warning", text: `${draftDocs} document${draftDocs === 1 ? "" : "s"} still in draft` });

      return { summary: sentences.join(" "), highlights: highlights.slice(0, 5) };
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
    summarize_channel: (ctx: MockContext) => {
      const name = (ctx.channel as string) || "channel";
      const messages = (ctx.messages as { text: string; authorName: string }[]) || [];
      if (messages.length === 0) return `## Today in ${name}\n\nNo messages yet — nothing to summarize.`;
      const authors = [...new Set(messages.map((m) => m.authorName))];
      const last = messages[messages.length - 1];
      return `## Today in ${name}\n\n${authors.length} participant${authors.length === 1 ? "" : "s"} (${authors.join(", ")}) across ${messages.length} message${messages.length === 1 ? "" : "s"}. Most recent, from ${last.authorName}: "${last.text.slice(0, 160)}"\n\n**Suggested next step:** reply to the latest message or flag anything that needs a decision.`;
    },
    summarize_task_comments: (ctx: MockContext) => {
      const taskName = (ctx.taskName as string) || "this task";
      const comments = (ctx.comments as { text: string; authorName: string }[]) || [];
      if (comments.length === 0) return `No comments yet on "${taskName}" — nothing to summarize.`;
      const authors = [...new Set(comments.map((c) => c.authorName))];
      return `## Discussion on "${taskName}"\n\n${authors.length} participant${authors.length === 1 ? "" : "s"} (${authors.join(", ")}) across ${comments.length} comment${comments.length === 1 ? "" : "s"}. Latest note: "${comments[comments.length - 1].text.slice(0, 160)}"\n\n**Suggested next step:** reply with a status update or unblock the open question above.`;
    },
    summarize_doc: (ctx: MockContext) => {
      const docName = (ctx.docName as string) || "this doc";
      const content = (ctx.content as string) || "";
      const words = content.trim().split(/\s+/).filter(Boolean);
      const preview = words.slice(0, 24).join(" ");
      return `## Summary of "${docName}"\n\n${words.length} words total. Opens with: "${preview}${words.length > 24 ? "…" : ""}"\n\n**Suggested next step:** skim the full doc for anything actionable that isn't reflected in an open task yet.`;
    },
    summarize_email_thread: (_ctx: MockContext) =>
      "Sarah at Acme is pushing the sprint 3 review from Wed to Thu (same 2pm slot) because something came up on her side. She's asking whether that clashes with anything and expects a same-day reply.",
    categorize_email: (ctx: MockContext) => {
      const from = ((ctx.from_email as string) || "").toLowerCase();
      const subject = ((ctx.subject as string) || "").toLowerCase();
      if (from.includes("github") || from.includes("vercel") || from.includes("stripe")) return { label: "Notifications", reasoning: "Automated service update, not a person-to-person message." };
      if (from.includes("acme") || subject.includes("sprint") || subject.includes("review")) return { label: "Clients", reasoning: "Client-facing thread — likely needs a personal reply." };
      if (from.includes("beacon") || subject.includes("proposal") || subject.includes("sow")) return { label: "Sales", reasoning: "Prospect proposal — routing to the sales workspace." };
      if (from.includes("digest") || from.includes("newsletter")) return { label: "Newsletter", reasoning: "Bulk newsletter — safe to archive after skim." };
      return { label: "Personal", reasoning: "No matching client/vendor rule — treating as personal correspondence." };
    },
    summarize_meeting: (ctx: MockContext) => {
      const title = (ctx.title as string) || "the meeting";
      return {
        summary: `${title}: kicked off with a review of current status, then walked through the near-term plan. Team agreed on the aggressive-but-doable target and named the main risk (data-import) so it stays visible next week.`,
        action_items: ["Data-import spike: 3-day timebox this week", "Diana to share success criteria doc by Wed", "Urvil to circulate weekly status template"],
      };
    },
    // HR Batch 1 — /hr/employees/[id] "AI Insights" tab.
    workload_summary_for_person: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This person";
      const hours = Number(ctx.available_hours_per_week) || 40;
      const assigned = Number(ctx.assigned_hours_per_week) || Math.round(hours * 0.7);
      const pct = Math.round((assigned / hours) * 100);
      return {
        summary: `${name} is allocated ${assigned}/${hours} hrs this week (${pct}%). ${pct > 100 ? "Currently over capacity — worth rebalancing a task to someone else." : pct > 85 ? "Close to full capacity, limited room for anything urgent." : "Has headroom for another task or two."}`,
        utilization_pct: pct,
      };
    },
    skill_matched_projects: (ctx: MockContext) => {
      const skills = ((ctx.skills as string[]) || []).map((s) => s.toLowerCase());
      const catalog: { project: string; skill: string }[] = [
        { project: "Website relaunch", skill: "react" },
        { project: "Mobile app v2", skill: "swift" },
        { project: "Data pipeline overhaul", skill: "python" },
        { project: "Client portal redesign", skill: "design" },
      ];
      const matches = catalog.filter((c) => skills.some((s) => c.skill.includes(s) || s.includes(c.skill)));
      return {
        matches: matches.map((m) => ({ project: m.project, reasoning: `Skill overlap on ${m.skill}.` })),
        reasoning: matches.length ? "Based on overlap between listed skills and active project tech/discipline tags." : "No direct skill overlap found with currently active projects.",
      };
    },
    suggest_career_growth: (ctx: MockContext) => {
      const title = ((ctx.job_title as string) || "their current role").toLowerCase();
      if (title.includes("junior") || title.includes("associate")) {
        return { suggestion: "On track for a mid-level promotion path — recommend pairing on a larger-scope project next quarter and formalizing mentorship time.", reasoning: "Junior/associate-titled roles typically show growth signal through scope expansion before a title change." };
      }
      if (title.includes("senior") || title.includes("lead")) {
        return { suggestion: "Well-positioned for a leadership or staff-track conversation — consider a stretch assignment owning a cross-team initiative.", reasoning: "Senior/lead-titled roles usually plateau without an explicit ownership stretch." };
      }
      return { suggestion: "Steady in current role — a skills refresh or a lateral stretch project would keep growth visible for the next review cycle.", reasoning: "No strong seniority signal in the title; defaulting to a general growth nudge." };
    },
    // HR Batch 2 — /hr/attendance Team Today view.
    summarize_team_attendance: (ctx: MockContext) => {
      const lateCount = Number(ctx.late_arrivals_this_week) || 0;
      const absentToday = Number(ctx.absent_today) || 0;
      return `## This week's attendance patterns\n\n- ${lateCount} late arrival${lateCount === 1 ? "" : "s"} logged across the team this week — worth a quick check-in if any one person accounts for more than one or two of those.\n- ${absentToday} unexplained absence${absentToday === 1 ? "" : "s"} today with no leave request on file.\n- Overall attendance looks steady week over week — no sharp drop-offs worth flagging beyond the individual items above.\n\nRecommend a light-touch 1:1 nudge for repeat-late arrivals rather than a policy change — small sample size so far.`;
    },
    // HR Batch 2 — /hr/employees/[id] Attendance tab.
    analyze_attendance_pattern: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This employee";
      const avgHours = Number(ctx.avg_hours_per_day) || 0;
      const onTimeRate = Number(ctx.on_time_rate) || 0;
      const tone = onTimeRate >= 90 ? "consistently punctual" : onTimeRate >= 70 ? "generally on time, with occasional late arrivals" : "showing a punctuality pattern worth a conversation";
      return {
        summary: `${name} is averaging ${avgHours || "—"} hrs/day and is ${tone} (${onTimeRate}% on-time rate this month). No sharp drop-offs in hours worked — the pattern looks stable week over week.`,
        reasoning: "Based on this month's check-in/check-out records compared against the org's workday-start threshold.",
      };
    },
    // HR Batch 2 — /hr/leave Approvals tab.
    suggest_leave_approval: (ctx: MockContext) => {
      const overlapping = Number(ctx.overlapping_leave_count) || 0;
      const teamSize = Number(ctx.team_size) || 5;
      const totalDays = Number(ctx.total_days) || 1;
      const risky = (teamSize > 0 && overlapping / teamSize >= 0.3) || totalDays > 10;
      return {
        recommendation: risky ? "flag" : "approve",
        reasoning: risky
          ? `${overlapping} other team member(s) already overlap these dates on a ${teamSize}-person team${totalDays > 10 ? `, and this request itself is ${totalDays} days` : ""} — worth a coverage check before approving.`
          : `Team coverage looks fine (${overlapping} overlapping out of ${teamSize}) and the request is a routine length (${totalDays} day${totalDays === 1 ? "" : "s"}).`,
      };
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
    // HR Batch 3 — /hr/reviews Team Reviews tab, manager assessment view.
    summarize_review_feedback: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This employee";
      const selfSummary = (ctx.self_assessment_summary as string) || "";
      return `${name}'s self-assessment ${selfSummary ? `highlights: "${selfSummary.slice(0, 120)}${selfSummary.length > 120 ? "…" : ""}"` : "hasn't been submitted yet"}. Overall signal points to solid, consistent delivery this cycle — recommend anchoring the manager assessment on concrete examples from the last few sprints rather than generalities, and naming one growth area explicitly so it's actionable next cycle.`;
    },
    // HR Batch 3 — /hr/recruitment candidate detail panel.
    summarize_candidate: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This candidate";
      const stage = (ctx.stage as string) || "applied";
      const rating = Number(ctx.rating) || 0;
      return {
        summary: `${name} is currently at the ${stage} stage${rating ? ` with a ${rating}/5 rating so far` : ""}. Background and notes on file suggest a reasonable fit for the role — recommend moving forward with the next interview round to validate technical depth and team fit before a decision.`,
        reasoning: "Based on stage progression, recorded rating, and notes on file — not a substitute for a full interview loop.",
      };
    },
    // HR Batch 4 — /hr/cases "Raise a Case" form.
    suggest_case_triage: (ctx: MockContext) => {
      const text = `${(ctx.subject as string) || ""} ${(ctx.description as string) || ""}`.toLowerCase();
      let category = "Other";
      let priority: "low" | "normal" | "high" | "urgent" = "normal";
      if (text.includes("pay") || text.includes("salary") || text.includes("payroll")) {
        category = "Payroll Query";
        priority = "high";
      } else if (text.includes("laptop") || text.includes("access") || text.includes("login") || text.includes("password") || text.includes("vpn")) {
        category = "IT Access";
        priority = "normal";
      } else if (text.includes("harass") || text.includes("bully") || text.includes("threat") || text.includes("unsafe")) {
        category = "Workplace Concern";
        priority = "urgent";
      } else if (text.includes("insurance") || text.includes("benefit") || text.includes("leave") || text.includes("pto")) {
        category = "Benefits";
        priority = "normal";
      } else if (text.includes("policy") || text.includes("handbook") || text.includes("rule")) {
        category = "Policy Question";
        priority = "low";
      }
      return {
        category,
        priority,
        reasoning: `Matched on keywords in the subject/description. ${priority === "urgent" ? "Flagged urgent — this reads like a workplace-safety concern and should route to HR directly." : "Adjust before submitting if the keyword match doesn't fit."}`,
      };
    },
    // HR Batch 4 — /hr/cases case detail (handler view).
    suggest_case_resolution: (ctx: MockContext) => {
      const category = (ctx.category as string) || "this category";
      return {
        suggestion: `Similar ${category} cases have typically resolved fastest with a direct 1:1 conversation rather than back-and-forth over comments — worth scheduling a short call if this hasn't moved in a day or two.`,
        similar_cases: [
          { subject: `${category} — access request delay`, resolution: "Resolved within 24h once IT was looped in directly." },
          { subject: `${category} — unclear on process`, resolution: "A 10-minute call clarified the policy faster than written back-and-forth." },
          { subject: `${category} — escalated from a teammate`, resolution: "Assigning to the category's default owner cut resolution time roughly in half." },
        ],
        reasoning: "Based on patterns from similar past cases in this category — not a substitute for reading this case's own comment thread.",
      };
    },
    // HR Batch 4 — /hr/training catalog (self-service recommendation).
    recommend_courses_for_employee: (ctx: MockContext) => {
      const role = ((ctx.job_title as string) || "").toLowerCase();
      const enrolled = (ctx.enrolled_course_titles as string[]) || [];
      const pool = role.includes("engineer") || role.includes("developer")
        ? ["Secure Coding Fundamentals", "Effective Code Review", "System Design Basics"]
        : role.includes("sales") || role.includes("account")
        ? ["Consultative Selling Skills", "Negotiation Fundamentals", "CRM Best Practices"]
        : role.includes("manage") || role.includes("lead")
        ? ["First-Time Manager Essentials", "Giving Effective Feedback", "Running Better 1:1s"]
        : ["Workplace Communication Essentials", "Time Management Fundamentals", "Company Policy Overview"];
      const suggestions = pool.filter((c) => !enrolled.includes(c)).slice(0, 3);
      return {
        courses: suggestions,
        reasoning: `Matched to the "${role || "general"}" role and filtered against current enrollments — a light starting set, not a required curriculum.`,
      };
    },
    // HR Batch 4 — /hr/surveys Results tab.
    summarize_survey_results: (ctx: MockContext) => {
      const total = Number(ctx.total_responses) || 0;
      const avgRatings = (ctx.average_ratings as number[]) || [];
      const avg = avgRatings.length ? avgRatings.reduce((s, n) => s + n, 0) / avgRatings.length : null;
      const sentiment = avg === null ? "not enough rating data yet" : avg >= 4 ? "clearly positive" : avg >= 3 ? "mixed, leaning positive" : "a real signal worth addressing";
      return `${total} response${total === 1 ? "" : "s"} in so far. Overall sentiment reads as ${sentiment}${avg !== null ? ` (avg rating ${avg.toFixed(1)}/5)` : ""}. The clearest theme in the open-text answers is a request for more clarity on process and ownership — worth a follow-up post or team update rather than a policy change at this response count.`;
    },
    // CRM Batch 1 — /crm/leads lead detail, "Score this lead".
    score_lead: (ctx: MockContext) => {
      const source = ((ctx.source as string) || "").toLowerCase();
      const hasCompany = Boolean(ctx.company_name);
      const hasEngagement = Number(ctx.activity_count) > 0;
      let score = 40;
      const reasons: string[] = [];
      if (source === "referral") { score += 25; reasons.push("referrals convert well historically"); }
      else if (source === "website" || source === "campaign") { score += 15; reasons.push("inbound intent signal"); }
      else if (source === "job_board") { score += 5; reasons.push("cold job-board source"); }
      if (hasCompany) { score += 15; reasons.push("has an identified company"); }
      if (hasEngagement) { score += 15; reasons.push("has logged engagement activity"); }
      score = Math.min(95, Math.max(5, score));
      return {
        score,
        reasoning: `${score}/100 — ${reasons.length ? reasons.join(", ") : "limited signal available yet"}. Re-score after the next touchpoint.`,
      };
    },
    // CRM Batch 1 — /crm/leads lead detail, "Enrich lead data".
    enrich_lead: (ctx: MockContext) => {
      const company = ((ctx.company_name as string) || "").toLowerCase();
      const email = ((ctx.email as string) || "").toLowerCase();
      const industry = company.includes("tech") || company.includes("soft") || email.includes("tech")
        ? "Technology"
        : company.includes("bank") || company.includes("capital") || company.includes("finance")
        ? "Financial Services"
        : company.includes("health") || company.includes("care") || company.includes("med")
        ? "Healthcare"
        : "Other";
      return {
        industry,
        website: company ? `https://www.${company.replace(/[^a-z0-9]/g, "")}.com` : null,
        employee_count_range: "11-50",
        job_title: (ctx.job_title as string) || "Decision Maker",
        reasoning: "Inferred from company name and email domain — a starting guess, verify before relying on it.",
      };
    },
    // CRM Batch 1 — /crm/accounts account detail, AI Insights tab.
    summarize_account: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This account";
      const contactCount = Number(ctx.contact_count) || 0;
      const lastActivityDays = ctx.last_activity_days_ago as number | undefined;
      const activityNote = lastActivityDays === undefined ? "no activity logged yet" : lastActivityDays > 30 ? `last activity ${lastActivityDays} days ago — going quiet` : `last activity ${lastActivityDays} days ago`;
      return `${name} has ${contactCount} contact${contactCount === 1 ? "" : "s"} on file, ${activityNote}. ${lastActivityDays !== undefined && lastActivityDays > 30 ? "Worth a check-in before this relationship goes cold." : "Relationship looks active."}`;
    },
    // CRM Batch 1 — /crm/contacts contact detail, AI Insights.
    summarize_contact: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This contact";
      const activityCount = Number(ctx.activity_count) || 0;
      const lastContactedDays = ctx.last_contacted_days_ago as number | undefined;
      if (activityCount === 0) return `No logged activity with ${name} yet — this relationship hasn't started.`;
      return `${activityCount} logged interaction${activityCount === 1 ? "" : "s"} with ${name}${lastContactedDays !== undefined ? `, last contacted ${lastContactedDays} day${lastContactedDays === 1 ? "" : "s"} ago` : ""}. ${lastContactedDays !== undefined && lastContactedDays > 14 ? "Due for a follow-up." : "Recently in touch."}`;
    },
    // CRM Batch 2 — /crm/deals/[id] AI Insights, "Predict close date".
    predict_deal_close: (ctx: MockContext) => {
      const stage = ((ctx.stage as string) || "prospecting").toLowerCase();
      const daysToClose: Record<string, number> = { prospecting: 60, discovery: 45, proposal: 30, negotiation: 15, contract_sent: 7 };
      const days = daysToClose[stage] ?? 45;
      const confidence: Record<string, number> = { prospecting: 40, discovery: 50, proposal: 60, negotiation: 75, contract_sent: 90 };
      const predicted = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const iso = `${predicted.getFullYear()}-${String(predicted.getMonth() + 1).padStart(2, "0")}-${String(predicted.getDate()).padStart(2, "0")}`;
      return {
        predicted_close_date: iso,
        confidence_percent: confidence[stage] ?? 50,
        reasoning: `Based on typical velocity for deals currently at the "${stage}" stage — informational only, not a commitment.`,
      };
    },
    // CRM Batch 3 — /crm/forecasts, "Analyze forecast".
    analyze_forecast: (ctx: MockContext) => {
      const target = Number(ctx.target_value) || 0;
      const won = Number(ctx.won_value) || 0;
      const weighted = Number(ctx.weighted_value) || 0;
      const gap = Number(ctx.gap) || 0;
      const period = (ctx.period as string) || "this period";
      const topDeals = (ctx.top_deal_names as string[]) || [];
      if (target === 0) return `No target set for ${period} yet — set one to get a gap-to-target read. Current weighted pipeline is ${weighted.toLocaleString()}, with ${won.toLocaleString()} already closed-won.`;
      const pctBehind = Math.round((gap / target) * 100);
      const status = gap <= 0 ? `on track — projected to close at ${Math.round(((won + weighted) / target) * 100)}% of target` : `${pctBehind}% behind target`;
      const dealNote = topDeals.length ? ` ${topDeals.slice(0, 2).join(" and ")} are the largest deals still in play — worth prioritizing close efforts there.` : "";
      return `${period} is ${status}. ${won.toLocaleString()} closed-won so far, plus ${weighted.toLocaleString()} weighted pipeline still open.${dealNote}`;
    },
    // CRM Batch 3 — /crm/campaigns/[id] AI Insights, "Analyze campaign performance".
    analyze_campaign: (ctx: MockContext) => {
      const name = (ctx.name as string) || "This campaign";
      const leads = Number(ctx.leads_count) || 0;
      const deals = Number(ctx.deals_count) || 0;
      const costPerLead = ctx.cost_per_lead as number | null | undefined;
      const roi = ctx.roi_percent as number | null | undefined;
      const conversionRate = leads > 0 ? Math.round((deals / leads) * 100) : 0;
      const roiNote = roi === null || roi === undefined ? "no spend logged yet, so ROI isn't calculable" : roi >= 0 ? `a positive ROI of ${Math.round(roi)}%` : `a negative ROI of ${Math.round(roi)}% — spend currently exceeds revenue won`;
      return `${name} generated ${leads} lead${leads === 1 ? "" : "s"}${costPerLead ? ` at ${Math.round(costPerLead).toLocaleString()}/lead` : ""}, with ${deals} converting to deal${deals === 1 ? "" : "s"} (${conversionRate}% lead-to-deal rate). Currently showing ${roiNote}.`;
    },
  },
  Planner: {
    create_project_draft: (ctx: MockContext) => {
      const prompt = (ctx.prompt as string) || "New project";
      return {
        goal: { name: `Goal: ${prompt}`, description: `Strategic goal derived from: ${prompt}` },
        project: { name: prompt.slice(0, 60), status: "planning" },
        milestones: [
          { name: "Discovery & Planning", description: "Requirements gathering and architecture" },
          { name: "Core Build", description: "Primary feature implementation" },
        ],
        sprints: [
          { name: "Sprint 1 — Foundation", startDate: "2026-08-11", endDate: "2026-08-22" },
          { name: "Sprint 2 — Build", startDate: "2026-08-25", endDate: "2026-09-05" },
        ],
        tasks: [
          { title: "Define requirements", sprintIndex: 0, priority: "high", estimate: 8 },
          { title: "Set up project structure", sprintIndex: 0, priority: "high", estimate: 4 },
          { title: "Implement core features", sprintIndex: 1, priority: "high", estimate: 16 },
          { title: "Write tests", sprintIndex: 1, priority: "medium", estimate: 8 },
          { title: "Documentation", sprintIndex: 1, priority: "low", estimate: 4 },
        ],
      };
    },
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
    suggest_task_breakdown: (ctx: MockContext) => {
      const title = ((ctx.title as string) || "").toLowerCase();
      if (title.includes("landing") || title.includes("page") || title.includes("site")) {
        return {
          subtask_titles: ["Wireframe the hero section", "Copy pass with brand voice", "Component build", "Cross-browser QA", "Publish + share preview link"],
          reasoning: "Typical marketing-page flow. Skip the wireframe step if you already have a Figma from a prior sprint.",
        };
      }
      if (title.includes("auth") || title.includes("login") || title.includes("signup")) {
        return {
          subtask_titles: ["Provider selection + docs read", "Backend session wiring", "UI: login + signup forms", "Error states + rate-limit", "E2E test happy path + reset"],
          reasoning: "5-step auth flow with the failure paths people usually skip until support tickets show up.",
        };
      }
      if (title.includes("migration") || title.includes("schema")) {
        return {
          subtask_titles: ["Draft the migration on a branch DB", "Backfill script if needed", "Deploy + smoke test", "Update ORM types", "Announce in Slack once green"],
          reasoning: "Migrations bite hardest at the announcement step — teams edit the same tables in parallel without knowing.",
        };
      }
      return {
        subtask_titles: ["Scope + definition of done", "Implementation", "Self-review + tests", "PR + reviewer sign-off", "Deploy + verify"],
        reasoning: "Generic 5-step breakdown. Trim or add rows before accepting — it should read like your team's actual playbook.",
      };
    },
    suggest_team_composition: (_ctx: MockContext) => [
      { role: "Project Manager", count: 1 },
      { role: "Developer", count: 2 },
      { role: "Designer", count: 1 },
      { role: "QA", count: 1 },
    ],
    // HR Batch 1 — Add/Edit Employee wizard, Step 4 (onboarding assignment).
    suggest_onboarding_template: (ctx: MockContext) => {
      const title = ((ctx.job_title as string) || "").toLowerCase();
      if (title.includes("sales") || title.includes("account exec") || title.includes("bdr")) {
        return { template_name: "Sales Onboarding", reasoning: "Job title matches a sales-track role — this template covers CRM access and pipeline process training." };
      }
      if (title.includes("engineer") || title.includes("developer") || title.includes("swe")) {
        return { template_name: "Developer Onboarding", reasoning: "Job title matches an engineering role — this template covers repo/infra access and architecture onboarding." };
      }
      return { template_name: "Generic Employee Onboarding", reasoning: "No role-specific template matched the job title — the generic checklist covers paperwork, setup, and orientation for any new hire." };
    },
    // HR Batch 1 — /hr/onboarding Templates tab, "AI: Generate steps" touchpoint.
    generate_onboarding_steps: (ctx: MockContext) => {
      const role = ((ctx.role as string) || "this role").toLowerCase();
      const base = [
        { title: "Sign offer letter", category: "paperwork", owner_role: "HR", days_after_start: -7 },
        { title: "Provision work email", category: "setup", owner_role: "IT", days_after_start: -1 },
        { title: "Welcome message", category: "orientation", owner_role: "Manager", days_after_start: 0 },
        { title: "Compliance & security training", category: "training", owner_role: "HR", days_after_start: 3 },
        { title: "First 1:1 with manager", category: "assignments", owner_role: "Manager", days_after_start: 3 },
      ];
      if (role.includes("engineer") || role.includes("developer")) {
        base.splice(2, 0, { title: "Grant repo and infra access", category: "setup", owner_role: "Engineering", days_after_start: 0 });
      }
      return { steps: base, reasoning: `Starter checklist generated for "${role}" — review and reorder before saving; this is a starting point, not a finished template.` };
    },
    // HR Batch 3 — /hr/okrs "+ New OKR" form.
    suggest_key_results: (ctx: MockContext) => {
      const objective = ((ctx.objective as string) || "").toLowerCase();
      if (objective.includes("revenue") || objective.includes("sales") || objective.includes("pipeline")) {
        return { key_results: ["Close $X in new ARR by end of period", "Grow qualified pipeline by 25%", "Reduce average sales-cycle length by 15%"], reasoning: "Standard revenue-objective triad: outcome, pipeline health, and velocity." };
      }
      if (objective.includes("hire") || objective.includes("recruit") || objective.includes("team")) {
        return { key_results: ["Fill N open roles by end of period", "Reduce average time-to-hire to under 30 days", "Maintain candidate NPS above 8/10"], reasoning: "Standard hiring-objective triad: throughput, speed, and candidate quality." };
      }
      return { key_results: ["Define and hit the primary success metric", "Ship the core deliverable on schedule", "Validate outcome with a follow-up check-in"], reasoning: "Generic 3-KR starting point — tighten these into measurable numbers before saving." };
    },
    // HR Batch 3 — /hr/recruitment interview scheduling.
    suggest_interview_questions: (ctx: MockContext) => {
      const title = ((ctx.job_title as string) || "").toLowerCase();
      if (title.includes("engineer") || title.includes("developer")) {
        return { questions: ["Walk me through a system you designed end-to-end — what tradeoffs did you make?", "Tell me about a time you had to debug something under time pressure.", "How do you decide when to write a test vs. ship and iterate?"], reasoning: "Engineering-role questions probing system design, debugging, and pragmatic judgment." };
      }
      if (title.includes("sales") || title.includes("account")) {
        return { questions: ["Walk me through your most difficult deal — how did you close it?", "How do you qualify a lead early to avoid wasted cycles?", "Tell me about a deal you lost and what you'd do differently."], reasoning: "Sales-role questions probing deal execution and self-reflection." };
      }
      return { questions: ["Tell me about a project you're proud of and your specific role in it.", "Describe a time you disagreed with a decision — how did you handle it?", "What does success look like for you in this role after 90 days?"], reasoning: "Generic behavioral triad covering ownership, collaboration, and goal clarity." };
    },
    // HR Batch 4 — /hr/surveys survey builder (admin only).
    suggest_survey_questions: (ctx: MockContext) => {
      const topic = ((ctx.topic as string) || "").toLowerCase();
      if (topic.includes("remote") || topic.includes("hybrid") || topic.includes("wfh")) {
        return {
          questions: [
            { text: "How satisfied are you with your current work arrangement?", type: "rating_1_5" },
            { text: "What's the biggest challenge in your current work setup?", type: "text" },
            { text: "Which work arrangement would you prefer?", type: "multiple_choice", options: ["Fully remote", "Hybrid", "Fully in-office"] },
          ],
          reasoning: "Standard remote-work pulse triad: satisfaction, open-ended pain point, preference.",
        };
      }
      if (topic.includes("manager") || topic.includes("leadership")) {
        return {
          questions: [
            { text: "I feel supported by my manager", type: "rating_1_5" },
            { text: "My manager gives me clear, actionable feedback", type: "rating_1_5" },
            { text: "What's one thing your manager could do differently?", type: "text" },
          ],
          reasoning: "Manager-relationship triad: two rating questions for trend tracking, one open-ended for specifics.",
        };
      }
      return {
        questions: [
          { text: "Overall, how satisfied are you working here?", type: "rating_1_5" },
          { text: "How likely are you to recommend this company as a place to work?", type: "rating_1_5" },
          { text: "What's one thing we could do to improve your experience?", type: "text" },
        ],
        reasoning: "Generic engagement triad (satisfaction, eNPS-style, open feedback) — tighten toward the specific goal before publishing.",
      };
    },
    // CRM Batch 1 — /crm/leads lead detail, "Suggest next action".
    suggest_lead_action: (ctx: MockContext) => {
      const status = ((ctx.status as string) || "new").toLowerCase();
      const daysSinceActivity = Number(ctx.days_since_last_activity) || 0;
      if (status === "new") return { action: "Make first contact — call or email within 24 hours while the lead is fresh.", reasoning: "New leads lose most of their reply-likelihood after the first day." };
      if (status === "contacted" && daysSinceActivity >= 3) return { action: `Schedule a discovery call — this lead has been in "contacted" for ${daysSinceActivity} days with no follow-up.`, reasoning: "Stalled contacted-stage leads rarely self-progress without a scheduled next step." };
      if (status === "contacted") return { action: "Send a follow-up with a specific value point (case study, pricing, demo offer).", reasoning: "Keep momentum going while the lead is still warm." };
      if (status === "qualified") return { action: "Move to convert — draft the account/contact and propose next steps.", reasoning: "Qualified leads with no conversion attempt are the easiest pipeline to lose to inaction." };
      return { action: "Review and re-engage or mark lost if there's no path forward.", reasoning: "No clear next step detected from current status/activity." };
    },
    // CRM Batch 1 — /crm/accounts account detail, "Suggest next steps".
    suggest_account_action: (ctx: MockContext) => {
      const daysSinceActivity = Number(ctx.days_since_last_activity);
      const dealCount = Number(ctx.contact_count) || 0;
      if (Number.isFinite(daysSinceActivity) && daysSinceActivity > 30) {
        return { action: "Schedule a quarterly review — no activity in 30+ days.", reasoning: "Accounts that go quiet for a month are the ones most likely to churn silently." };
      }
      if (dealCount === 0) {
        return { action: "Add a primary contact — this account has none on file yet.", reasoning: "An account with no linked contact has no clear path to a conversation." };
      }
      return { action: "Relationship looks healthy — keep the current cadence.", reasoning: "Recent activity and at least one contact on file." };
    },
    // CRM Batch 2 — /crm/deals/[id] AI Insights, "Suggest next step".
    suggest_deal_next_step: (ctx: MockContext) => {
      const stage = ((ctx.stage as string) || "prospecting").toLowerCase();
      const daysSinceActivity = Number(ctx.days_since_last_activity) || 0;
      const dueIn = (days: number) => {
        const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      if (stage === "prospecting") return { next_step: "Schedule a discovery call to understand needs and budget.", due_date: dueIn(3), reasoning: "Prospecting-stage deals need a discovery call to advance to the next stage." };
      if (stage === "discovery") return { next_step: "Send a tailored proposal based on discovery findings.", due_date: dueIn(5), reasoning: "Discovery is complete signal to move toward a formal proposal." };
      if (stage === "proposal" && daysSinceActivity >= 5) return { next_step: "Follow up on the proposal — no response in over 5 days.", due_date: dueIn(1), reasoning: "Proposals that go quiet need a nudge before they stall out." };
      if (stage === "negotiation") return { next_step: "Confirm final terms and send the contract.", due_date: dueIn(3), reasoning: "Negotiation-stage deals are close — keep momentum toward a signed contract." };
      if (stage === "contract_sent") return { next_step: "Follow up on contract signature.", due_date: dueIn(2), reasoning: "Sent contracts need active follow-up, not passive waiting." };
      return { next_step: "Review deal status and confirm next action with the account.", due_date: dueIn(3), reasoning: "No stage-specific signal available." };
    },
    // CRM Batch 3 — /crm/forecasts, "Suggest pipeline actions".
    suggest_pipeline_actions: (ctx: MockContext) => {
      const staleDeals = (ctx.stale_deal_names as string[]) || [];
      const overdueDeals = (ctx.overdue_deal_names as string[]) || [];
      const negotiationDeals = (ctx.negotiation_deal_names as string[]) || [];
      const actions: { action: string; deal_name: string; reasoning: string }[] = [];
      for (const name of staleDeals.slice(0, 2)) {
        actions.push({ action: "Re-engage — no stage movement in over 14 days", deal_name: name, reasoning: "Stalled deals rarely self-resolve without a direct nudge." });
      }
      for (const name of overdueDeals.slice(0, 2)) {
        actions.push({ action: "Update expected close date or escalate", deal_name: name, reasoning: "Past-due deals distort forecast accuracy until resolved." });
      }
      for (const name of negotiationDeals.slice(0, 2)) {
        actions.push({ action: "Push to close — deal is in final-stage negotiation", deal_name: name, reasoning: "High-probability deals closest to target are the fastest way to close the gap." });
      }
      if (actions.length === 0) {
        actions.push({ action: "Pipeline looks healthy — no stalled or overdue deals detected", deal_name: "—", reasoning: "No specific risk signals found in the current period's deals." });
      }
      return { actions: actions.slice(0, 5) };
    },
    // CRM Batch 3 — /crm/campaigns/[id] AI Insights, "Suggest campaign improvements".
    suggest_campaign_improvements: (ctx: MockContext) => {
      const type = ((ctx.type as string) || "email").toLowerCase();
      const costPerLead = ctx.cost_per_lead as number | null | undefined;
      const roi = ctx.roi_percent as number | null | undefined;
      const improvements: { suggestion: string; reasoning: string; expected_impact: string }[] = [];
      if (roi !== null && roi !== undefined && roi < 0) {
        improvements.push({ suggestion: "Pause spend and reassess targeting before continuing", reasoning: "Negative ROI means current spend is losing money relative to revenue won.", expected_impact: "Stops further budget loss while messaging/targeting is revisited." });
      }
      if (costPerLead !== null && costPerLead !== undefined && costPerLead > 300) {
        improvements.push({ suggestion: `Tighten audience targeting to reduce cost-per-lead (currently ${Math.round(costPerLead)})`, reasoning: "A high cost-per-lead relative to typical campaign benchmarks suggests targeting is too broad.", expected_impact: "Narrower targeting typically cuts cost-per-lead by 20-40%." });
      }
      improvements.push({
        suggestion: type === "email" ? "A/B test subject lines to improve open rate" : "Test a second creative variant to compare engagement",
        reasoning: "Incremental creative testing is the lowest-risk lever for improving campaign performance.",
        expected_impact: "Typically a 10-15% lift in engagement from the better-performing variant.",
      });
      return { improvements: improvements.slice(0, 3) };
    },
    // AI Assistant — /ai/sprint-plans "Generate New Plan".
    generate_sprint_plan: (ctx: MockContext) => {
      const projectName = (ctx.project_name as string) || "this project";
      const backlog = (ctx.backlog_tasks as { id: string; title: string; estimate: number | null; priority: string }[]) || [];
      const members = (ctx.team_members as { id: string; name: string; available_hours_per_week: number }[]) || [];

      const totalCapacity = members.reduce((sum, m) => sum + (m.available_hours_per_week || 0), 0);
      const sorted = [...backlog].sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      });

      // Round-robin assignment against remaining capacity, filling
      // highest-priority backlog first until capacity runs out.
      const remaining = members.map((m) => ({ ...m, remaining: m.available_hours_per_week }));
      const tasks: { title: string; assignee_name: string; estimate: number; priority: string }[] = [];
      let totalEstimated = 0;
      for (const t of sorted) {
        const estimate = t.estimate ?? 4;
        const candidate = remaining.filter((m) => m.remaining > 0).sort((a, b) => b.remaining - a.remaining)[0];
        if (!candidate) break;
        candidate.remaining -= estimate;
        totalEstimated += estimate;
        tasks.push({ title: t.title, assignee_name: candidate.name, estimate, priority: t.priority });
        if (tasks.length >= 10) break;
      }

      const utilizationPercent = totalCapacity > 0 ? Math.round((totalEstimated / totalCapacity) * 100) : 0;
      const overAllocated = remaining.filter((m) => m.remaining < 0).map((m) => m.name);
      const warnings = overAllocated.length
        ? [`${overAllocated.join(", ")} ${overAllocated.length === 1 ? "is" : "are"} carrying more than their available hours — consider redistributing before approving.`]
        : utilizationPercent > 100
        ? ["Total estimated work exceeds total team capacity for this sprint window."]
        : [];

      const now = new Date((ctx.today as string) || "2026-07-31");
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 14);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      return {
        sprint_name: `${projectName} — Sprint ${iso(start).slice(5)}`,
        start_date: iso(start),
        end_date: iso(end),
        tasks,
        capacity_analysis: {
          total_capacity: totalCapacity,
          total_estimated: totalEstimated,
          utilization_percent: utilizationPercent,
          warnings,
        },
        reasoning: `Pulled ${sorted.length} open backlog item${sorted.length === 1 ? "" : "s"} for ${projectName}, prioritized urgent/high first, and assigned each to whoever had the most remaining capacity at that point. Utilization lands at ${utilizationPercent}% of the team's ${totalCapacity}h/week across ${members.length} member${members.length === 1 ? "" : "s"}.${warnings.length ? " Review the flagged over-allocation before approving." : " No one is over-allocated at this split."}`,
      };
    },
  },
  Monitor: {
    project_health_scan: (ctx: MockContext) => {
      const name = (ctx.projectName as string) || "Project";
      return {
        signals: {
          totalTasks: 15, openTasks: 8, doneTasks: 7, overdueTasks: 2, blockedTasks: 1,
          sprints: [
            { id: "s1", name: "Sprint 1", status: "completed", totalTasks: 5, doneTasks: 5, burnRate: 1.0 },
            { id: "s2", name: "Sprint 2", status: "active", totalTasks: 10, doneTasks: 2, burnRate: 0.2 },
          ],
        },
        aiSummary: `${name} is progressing steadily with 47% of tasks completed. Two tasks are overdue in the current sprint and one is blocked by an unresolved dependency. Consider re-prioritising the blocked item to maintain velocity.`,
      };
    },
    // HR Batch 2 — /hr/attendance Team Today view.
    flag_attendance_anomalies: (ctx: MockContext) => {
      const names = (ctx.employee_names as string[]) || [];
      if (names.length === 0) {
        return { anomalies: [], reasoning: "Not enough attendance history yet to detect a pattern." };
      }
      const patterns = ["repeated late arrivals", "unusually short workdays this week", "a sudden absence spike vs. last month"];
      return {
        anomalies: names.slice(0, Math.min(3, names.length)).map((name, i) => ({
          employee_name: name,
          pattern: patterns[i % patterns.length],
        })),
        reasoning: "Flagged from this week's check-in/check-out records compared against each person's own trailing average — not compared against a fixed company-wide bar.",
      };
    },
    // HR Batch 2 — Request Leave modal.
    check_leave_coverage: (ctx: MockContext) => {
      const overlapping = Number(ctx.overlapping_leave_count) || 0;
      const teamSize = Number(ctx.team_size) || 5;
      const risky = teamSize > 0 && overlapping / teamSize >= 0.3;
      return {
        coverage_status: risky ? "risky" : "good",
        overlapping_leave_count: overlapping,
        reasoning: risky
          ? `${overlapping} other team member(s) already have approved or pending leave overlapping these dates — that's a meaningful chunk of a ${teamSize}-person team out at once.`
          : overlapping > 0
          ? `${overlapping} other team member(s) overlap, but coverage looks fine for a team of ${teamSize}.`
          : "No one else on the team has overlapping leave for these dates.",
      };
    },
    // CRM Batch 2 — /crm/deals/[id] AI Insights, "Assess deal risk".
    assess_deal_risk: (ctx: MockContext) => {
      const daysInStage = Number(ctx.days_in_stage) || 0;
      const daysSinceActivity = Number(ctx.days_since_last_activity) || 0;
      const isPastDue = ctx.is_past_due === true;
      const stage = (ctx.stage as string) || "prospecting";

      // TODO: 14-day stale threshold is hardcoded — make this an org
      // setting once there's a real config surface for it.
      const staleFlags: string[] = [];
      if (daysInStage > 14) staleFlags.push(`${daysInStage} days in "${stage}" with no stage movement`);
      if (daysSinceActivity > 10) staleFlags.push(`${daysSinceActivity} days since the last logged activity`);
      if (isPastDue) staleFlags.push("expected close date has already passed");

      const riskLevel = staleFlags.length >= 2 || isPastDue ? "high" : staleFlags.length === 1 ? "medium" : "low";
      const suggestedActions =
        riskLevel === "high"
          ? ["Schedule a direct call with the primary contact this week", "Confirm the deal is still active and re-qualify budget/timeline", "Escalate to the account owner if no response within 3 days"]
          : riskLevel === "medium"
          ? ["Log a follow-up activity to re-establish momentum", "Confirm the next step and due date are still realistic"]
          : ["No action needed — deal is progressing normally"];

      return {
        risk_level: riskLevel,
        reasoning: staleFlags.length ? `Flagged: ${staleFlags.join("; ")}.` : "No stagnation or overdue signals detected.",
        suggested_actions: suggestedActions,
      };
    },
  },
} as const;

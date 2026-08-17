import type { MockContext } from "./mockResponses";

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  Writer:
    "You are a professional business writer for Centr8 OS, an AI-native project management platform. You draft clear, concise documents, emails, and communications. Write in a direct, professional tone. When asked for JSON output, respond ONLY with valid JSON — no markdown fences, no commentary.",
  Analyst:
    "You are a data analyst for Centr8 OS, an AI-native project management platform. You analyze data, identify patterns, score leads, and generate insights. Be specific and data-driven. When asked for JSON output, respond ONLY with valid JSON — no markdown fences, no commentary.",
  Planner:
    "You are a project planning assistant for Centr8 OS, an AI-native project management platform. You structure work into clear, actionable plans with realistic timelines. When asked for JSON output, respond ONLY with valid JSON — no markdown fences, no commentary.",
  Monitor:
    "You are a risk and health monitoring agent for Centr8 OS, an AI-native project management platform. You assess health signals, flag risks, and suggest mitigations. When asked for JSON output, respond ONLY with valid JSON — no markdown fences, no commentary.",
  Communicator:
    "You are a communications agent for Centr8 OS. You draft standup summaries, client updates, and team notifications. Write clearly and concisely.",
};

export function getSystemPrompt(agent: string): string {
  return AGENT_SYSTEM_PROMPTS[agent] || AGENT_SYSTEM_PROMPTS.Analyst;
}

type PromptBuilder = (ctx: MockContext) => { prompt: string; json: boolean };

const writerPrompts: Record<string, PromptBuilder> = {
  project_description: (ctx) => ({
    prompt: `Write a 2-3 sentence project description for a project called "${ctx.name || "this project"}". Focus on objectives, approach, and success metrics. Return plain text only.`,
    json: false,
  }),
  project_brief: (ctx) => ({
    prompt: `Write a project brief in markdown for "${ctx.name || "Untitled Project"}". Include sections: Summary, Objectives (3-4 bullets), Scope (in/out), Milestones (4 items), Success metrics (3 items), Risks (3 items). Return plain markdown text.`,
    json: false,
  }),
  deadline_summary: (ctx) => {
    const items = ctx.deadlines as { title: string; days: number; kind: string; sub: string }[] | undefined;
    const deadlineInfo = items?.length
      ? `Upcoming deadlines:\n${items.map((i) => `- "${i.title}" (${i.kind}) due in ${i.days} days, owned by ${i.sub}`).join("\n")}`
      : "No deadlines are currently set.";
    return {
      prompt: `Summarize these project deadlines in 2-4 sentences. Group by urgency (next 48h, this week, later). Mention if nothing is overdue. Be actionable.\n\n${deadlineInfo}\n\nReturn plain text only.`,
      json: false,
    };
  },
  portfolio_summary: (ctx) => ({
    prompt: `Summarize portfolio health in 2-3 sentences. Stats: ${ctx.total || 0} total projects, ${ctx.active || 0} active, ${ctx.atRisk || 0} at risk. Suggest a concrete next action. Return plain text only.`,
    json: false,
  }),
  draft_slack_reply: (ctx) => ({
    prompt: `Draft a short, casual Slack reply (1-2 sentences) to this message: "${ctx.preview || ""}". Be friendly and professional. Return plain text only.`,
    json: false,
  }),
  draft_email_reply: (ctx) => ({
    prompt: `Draft a professional email reply. Original subject: "${ctx.subject || ""}". Return JSON: {"subject": "Re: ...", "body": "..."}. Sign off as "Urvil".`,
    json: true,
  }),
  draft_meeting_notes_template: (ctx) => ({
    prompt: `Generate a structured meeting notes template (markdown) for a meeting titled "${ctx.title || "Meeting"}" with attendees: ${((ctx.attendees as string[] | undefined) ?? []).join(", ") || "(none listed)"}. Include sections for Agenda, Discussion notes, Decisions, and Action items — leave the content blank/fill-in-able, this is a template for the user to complete during/after the meeting, not fabricated content. Return plain text (markdown).`,
    json: false,
  }),
  summarize_call: (ctx) => ({
    prompt: `Summarize a call with ${ctx.participant || "the caller"}. ${ctx.notes ? `Notes: "${ctx.notes}"` : "No notes provided."}. Return JSON: {"summary": "2-3 sentence summary", "action_items": ["item1", "item2", "item3"]}`,
    json: true,
  }),
  kickoff_notes: (ctx) => ({
    prompt: `Write a project kick-off agenda in markdown for "${ctx.name || "the project"}". Include: objectives, team roles, timeline overview, risks, and follow-up actions. Return plain markdown text.`,
    json: false,
  }),
  draft_self_assessment: (ctx) => ({
    prompt: `Draft a self-assessment for ${ctx.name || "an employee"} for the "${ctx.cycle_name || "current"}" review cycle. Return JSON: {"strengths": "2-3 sentences", "areas_for_growth": "2-3 sentences", "achievements": "2-3 bullet points as text", "goals_next_period": "2-3 bullet points as text"}`,
    json: true,
  }),
  draft_job_posting: (ctx) => ({
    prompt: `Draft a job posting for "${ctx.title || "Software Engineer"}" in the ${ctx.department || "Engineering"} department. Return JSON: {"description": "3-4 paragraph job description", "requirements": "bulleted list as text"}`,
    json: true,
  }),
  generate_course_outline: (ctx) => ({
    prompt: `Generate a training course outline for "${ctx.title || "Training Course"}". Return JSON: {"description": "2-3 sentence course description", "category": "one of: technical, soft_skills, compliance, leadership, onboarding", "duration_minutes": number}`,
    json: true,
  }),
  draft_crm_email: (ctx) => ({
    prompt: `Draft a CRM follow-up email for contact "${ctx.name || "the contact"}". ${ctx.recent_activity_summary ? `Recent activity: ${ctx.recent_activity_summary}` : ""}. Return JSON: {"subject": "email subject", "body": "email body", "reasoning": "why this approach"}. Sign as "Urvil".`,
    json: true,
  }),
  draft_deal_proposal: (ctx) => ({
    prompt: `Draft a deal proposal email for "${ctx.deal_name || "this deal"}" to ${ctx.contact_name || "the contact"}. Deal value: ${ctx.value || 0} ${ctx.currency || "USD"}. Return JSON: {"subject": "email subject", "body": "professional proposal email body", "reasoning": "why this framing"}. Sign as "Urvil".`,
    json: true,
  }),
  draft_campaign_copy: (ctx) => ({
    prompt: `Draft campaign copy for a ${ctx.type || "email"} campaign. Target audience: ${ctx.target_audience || "general"}. Description: ${ctx.description || "promotional campaign"}. Return JSON: {"subject": ${ctx.type === "social" || ctx.type === "paid_ads" ? "null" : '"catchy subject line"'}, "body": "campaign copy text", "channel_note": "one sentence on channel-specific tips", "reasoning": "why this approach"}`,
    json: true,
  }),
  generate_document: (ctx) => ({
    prompt: `Generate a ${ctx.doc_type || "document"} for project "${ctx.project_name || "the project"}". ${ctx.context ? `Context: ${ctx.context}` : ""}. Today's date: ${ctx.today || new Date().toISOString().split("T")[0]}. Return JSON: {"title": "document title", "content": "full document content in markdown"}. Make it thorough and professional.`,
    json: true,
  }),
};

const analystPrompts: Record<string, PromptBuilder> = {
  suggest_priority: (ctx) => ({
    prompt: `Suggest a priority level for a project. ${ctx.endDate ? `End date is set: ${ctx.endDate}` : "No end date set."}. Return JSON: {"priority": "high" or "medium" or "low", "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_tags: (ctx) => ({
    prompt: `Suggest 3-5 relevant tags for a project called "${ctx.name || "Untitled"}". Return JSON: {"tags": ["tag1", "tag2", ...], "reasoning": "one sentence"}`,
    json: true,
  }),
  estimate_budget: (ctx) => ({
    prompt: `Estimate a budget range for a ${ctx.durationWeeks || 12}-week project. Currency: ${ctx.currency || "USD"}. Consider team costs, tools, and contingency. Return JSON: {"amount_low": number, "amount_high": number, "currency": "${ctx.currency || "USD"}", "reasoning": "one sentence"}`,
    json: true,
  }),
  ask: (ctx) => ({
    prompt: `Answer this workspace question concisely: "${ctx.question || ""}". Return plain text only.`,
    json: false,
  }),
  ask_ai: (ctx) => {
    const history = (ctx.conversation_history as { role: string; content: string }[]) || [];
    const historyText = history.length
      ? `\nConversation so far:\n${history.map((m) => `${m.role}: ${m.content}`).join("\n")}\n`
      : "";
    return {
      prompt: `You are a workspace AI assistant. Answer questions about projects, tasks, team, HR, and CRM data.${historyText}\nUser question: "${ctx.question || ""}"\n\nReturn JSON: {"answer": "your helpful answer", "citations": [{"source_type": "workspace_data", "source_title": "relevant source", "excerpt": "key detail"}]}. Include 1-3 relevant citations.`,
      json: true,
    };
  },
  generate_recommendations: (ctx) => ({
    prompt: `Generate actionable cross-pillar recommendations based on these signals:
- Overdue tasks: ${ctx.overdue_tasks_count || 0}
- Over-allocated team members: ${(ctx.over_allocated_members as string[])?.join(", ") || "none"}
- At-risk projects: ${(ctx.at_risk_project_names as string[])?.join(", ") || "none"}
- At-risk deals: ${(ctx.at_risk_deal_names as string[])?.join(", ") || "none"}
- Pending leave requests: ${ctx.pending_leave_requests || 0}
- Pending sprint plans: ${ctx.pending_sprint_plans || 0}

Return JSON: {"recommendations": [{"id": "rec_1", "priority": "high"/"medium"/"low", "title": "short title", "description": "actionable description", "category": "pm"/"hr"/"crm"/"ai", "action_type": "review"/"reassign"/"schedule"/"follow_up", "reasoning": "why this matters"}]}. Generate 3-6 recommendations, most urgent first.`,
    json: true,
  }),
  daily_briefing: (ctx) => {
    const d = ctx.dashboard_data as Record<string, unknown> | undefined;
    return {
      prompt: `Generate a daily briefing summary for this org's dashboard data: ${JSON.stringify(d || {})}.
Return JSON: {"summary": "3-5 sentence overview of the day", "highlights": [{"type": "positive" or "warning" or "action_needed", "text": "one-line highlight"}]}. Include 3-5 highlights.`,
      json: true,
    };
  },
  recommend_members_for_role: (ctx) => ({
    prompt: `Recommend 3 team members for the role of "${ctx.role || "Team Member"}". Return a JSON array: [{"name": "Full Name", "reason": "why they fit"}]. Use plausible professional names.`,
    json: true,
  }),
  summarize_channel: (ctx) => {
    const messages = (ctx.messages as { text: string; authorName: string }[] | undefined) ?? [];
    const transcript = messages.map((m) => `${m.authorName}: ${m.text}`).join("\n");
    return {
      prompt: transcript
        ? `Summarize this chat channel's discussion in 3-4 sentences, mentioning key topics and any action items. Return plain text (can include markdown).\n\nTranscript:\n${transcript}`
        : `The "${ctx.channel || "channel"}" channel has no messages yet. Say briefly that there's nothing to summarize.`,
      json: false,
    };
  },
  summarize_email_thread: () => ({
    prompt: `Summarize an email thread briefly in 1-2 sentences. The thread is about a client project status update. Return plain text only.`,
    json: false,
  }),
  categorize_email: (ctx) => ({
    prompt: `Categorize this email. From: ${ctx.from_email || "unknown"}, Subject: "${ctx.subject || ""}". Return JSON: {"label": "one of: Notifications, Clients, Sales, Newsletter, Personal, Internal", "reasoning": "one sentence"}`,
    json: true,
  }),
  summarize_meeting: (ctx) => ({
    prompt: `Summarize a meeting titled "${ctx.title || "Team Meeting"}". Return JSON: {"summary": "2-3 sentence summary", "action_items": ["item1", "item2", "item3"]}`,
    json: true,
  }),
  workload_summary_for_person: (ctx) => ({
    prompt: `Summarize workload for ${ctx.name || "this person"}. Available: ${ctx.available_hours_per_week || 40}h/week, Assigned: ${ctx.assigned_hours_per_week || 0}h/week. Return JSON: {"summary": "one sentence about their workload status", "utilization_pct": number 0-100}`,
    json: true,
  }),
  skill_matched_projects: (ctx) => ({
    prompt: `Match these skills to active projects: ${(ctx.skills as string[])?.join(", ") || "general"}. Return JSON: {"matches": [{"project": "project name", "reasoning": "why this matches"}], "reasoning": "overall summary"}. Suggest 2-3 plausible project matches.`,
    json: true,
  }),
  suggest_career_growth: (ctx) => ({
    prompt: `Suggest a career growth path for someone with the title "${ctx.job_title || "Employee"}". Return JSON: {"suggestion": "2-3 sentences on growth path", "reasoning": "why this direction"}`,
    json: true,
  }),
  summarize_team_attendance: (ctx) => ({
    prompt: `Summarize team attendance this week. Late arrivals: ${ctx.late_arrivals_this_week || 0}, Absent today: ${ctx.absent_today || 0}. Write 2-3 sentences with any recommendations. Return plain text (can use markdown).`,
    json: false,
  }),
  analyze_attendance_pattern: (ctx) => ({
    prompt: `Analyze attendance for ${ctx.name || "this employee"}. Avg hours/day: ${ctx.avg_hours_per_day || 8}, On-time rate: ${ctx.on_time_rate || 100}%. Return JSON: {"summary": "one sentence pattern analysis", "reasoning": "supporting detail"}`,
    json: true,
  }),
  suggest_leave_approval: (ctx) => ({
    prompt: `Should this leave request be approved? Overlapping leaves: ${ctx.overlapping_leave_count || 0}, Team size: ${ctx.team_size || 5}, Days requested: ${ctx.total_days || 1}. Return JSON: {"recommendation": "approve" or "flag", "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_budget_breakdown: (ctx) => ({
    prompt: `Suggest a budget breakdown for a project with ${ctx.allocatedBudget || 100000} allocated. Return JSON: {"labor": number, "software": number, "services": number, "other": number, "reasoning": "one sentence explaining the split"}. Values should sum to roughly the allocated budget.`,
    json: true,
  }),
  summarize_review_feedback: (ctx) => ({
    prompt: `Summarize performance review feedback for ${ctx.name || "this employee"}. ${ctx.self_assessment_summary ? `Self-assessment: "${ctx.self_assessment_summary}"` : ""}. Write a 2-3 sentence summary for the manager's review. Return plain text only.`,
    json: false,
  }),
  summarize_candidate: (ctx) => ({
    prompt: `Summarize recruitment candidate ${ctx.name || "this candidate"}. Current stage: ${ctx.stage || "new"}, Rating: ${ctx.rating || 0}/5. Return JSON: {"summary": "one sentence candidate overview", "reasoning": "fit signal assessment"}`,
    json: true,
  }),
  suggest_case_triage: (ctx) => ({
    prompt: `Triage this HR case. Subject: "${ctx.subject || ""}". Description: "${ctx.description || ""}". Return JSON: {"category": "IT Support" or "HR Policy" or "Facilities" or "Payroll" or "Conduct" or "Benefits", "priority": "low" or "normal" or "high" or "urgent", "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_case_resolution: (ctx) => ({
    prompt: `Suggest a resolution for an HR case in category "${ctx.category || "General"}". Return JSON: {"suggestion": "2-3 sentence resolution approach", "similar_cases": [{"subject": "example case", "resolution": "how it was resolved"}], "reasoning": "why this approach"}. Include 2 similar case examples.`,
    json: true,
  }),
  recommend_courses_for_employee: (ctx) => ({
    prompt: `Recommend training courses for a "${ctx.job_title || "Employee"}". Already enrolled in: ${(ctx.enrolled_course_titles as string[])?.join(", ") || "none"}. Return JSON: {"courses": ["Course Name 1", "Course Name 2", "Course Name 3"], "reasoning": "why these courses"}. Suggest up to 3 courses they haven't taken.`,
    json: true,
  }),
  summarize_survey_results: (ctx) => ({
    prompt: `Summarize engagement survey results. Total responses: ${ctx.total_responses || 0}. Average ratings across questions: ${(ctx.average_ratings as number[])?.join(", ") || "N/A"} (scale 1-5). Write 2-3 sentences on overall sentiment and themes. Return plain text only.`,
    json: false,
  }),
  score_lead: (ctx) => ({
    prompt: `Score this CRM lead. Source: ${ctx.source || "unknown"}, Company: ${ctx.company_name || "unknown"}, Activity count: ${ctx.activity_count || 0}. Return JSON: {"score": number 1-100, "reasoning": "one sentence explaining the score"}. Higher activity and known companies = higher score.`,
    json: true,
  }),
  enrich_lead: (ctx) => ({
    prompt: `Enrich this lead's data. Company: "${ctx.company_name || "unknown"}", Email: "${ctx.email || ""}", Title: "${ctx.job_title || ""}". Return JSON: {"industry": "inferred industry", "website": "plausible website URL or null", "employee_count_range": "e.g. 51-200", "job_title": "normalized title", "reasoning": "how you inferred this"}`,
    json: true,
  }),
  summarize_account: (ctx) => ({
    prompt: `Write a one-line CRM account summary for "${ctx.name || "this account"}". Contacts: ${ctx.contact_count || 0}, Last activity: ${ctx.last_activity_days_ago || 0} days ago. Return plain text only.`,
    json: false,
  }),
  summarize_contact: (ctx) => ({
    prompt: `Write a one-line CRM contact engagement summary for "${ctx.name || "this contact"}". Activities: ${ctx.activity_count || 0}, Last contacted: ${ctx.last_contacted_days_ago || 0} days ago. Return plain text only.`,
    json: false,
  }),
  predict_deal_close: (ctx) => ({
    prompt: `Predict when this deal will close. Current stage: "${ctx.stage || "prospecting"}". Return JSON: {"predicted_close_date": "YYYY-MM-DD", "confidence_percent": number 0-100, "reasoning": "one sentence"}. Later stages = sooner close, higher confidence.`,
    json: true,
  }),
  analyze_forecast: (ctx) => ({
    prompt: `Analyze this sales forecast. Target: ${ctx.target_value || 0}, Won: ${ctx.won_value || 0}, Weighted pipeline: ${ctx.weighted_value || 0}, Gap: ${ctx.gap || 0}, Period: ${ctx.period || "this quarter"}. Top deals: ${(ctx.top_deal_names as string[])?.join(", ") || "none"}. Write 2-3 sentences on gap-to-target with deal callouts. Return plain text only.`,
    json: false,
  }),
  analyze_campaign: (ctx) => ({
    prompt: `Analyze this campaign's performance. Name: "${ctx.name || "Campaign"}", Leads: ${ctx.leads_count || 0}, Deals: ${ctx.deals_count || 0}, Cost per lead: ${ctx.cost_per_lead ?? "N/A"}, ROI: ${ctx.roi_percent ?? "N/A"}%. Write 2-3 sentences on performance. Return plain text only.`,
    json: false,
  }),
};

const plannerPrompts: Record<string, PromptBuilder> = {
  create_project_draft: (ctx) => ({
    prompt: `Create a full project plan from this request: "${ctx.prompt || "New project"}"

Return JSON with this exact shape:
{
  "goal": {"name": "goal title", "description": "goal description"},
  "project": {"name": "project name", "status": "planning"},
  "milestones": [{"name": "milestone name", "description": "description"}],
  "sprints": [{"name": "sprint name", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}],
  "tasks": [{"title": "task title", "sprintIndex": 0, "priority": "high"/"medium"/"low", "estimate": hours_number}]
}

Include 2-3 milestones, 2-3 sprints, and 4-6 tasks. Use realistic dates starting from next week.`,
    json: true,
  }),
  suggest_timeline: (ctx) => ({
    prompt: `Suggest a project timeline. Today is ${ctx.today || new Date().toISOString().split("T")[0]}. Return JSON: {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "reasoning": "one sentence"}. Start one week from today, suggest a realistic duration.`,
    json: true,
  }),
  suggest_task_breakdown: (ctx) => ({
    prompt: `Break down this task into 4-6 subtasks: "${ctx.title || "Task"}". Return JSON: {"subtask_titles": ["subtask 1", "subtask 2", ...], "reasoning": "one sentence on the breakdown approach"}`,
    json: true,
  }),
  suggest_team_composition: () => ({
    prompt: `Suggest a team composition for a typical software project. Return a JSON array: [{"role": "role title", "count": number}]. Include 4-5 roles.`,
    json: true,
  }),
  suggest_onboarding_template: (ctx) => ({
    prompt: `Suggest an onboarding template for a new hire with title "${ctx.job_title || "Employee"}". Return JSON: {"template_name": "template name", "reasoning": "why this template fits"}`,
    json: true,
  }),
  generate_onboarding_steps: (ctx) => ({
    prompt: `Generate onboarding checklist steps for a new "${ctx.role || "Employee"}". Return JSON: {"steps": [{"title": "step title", "category": "admin"/"team"/"tools"/"training", "owner_role": "HR"/"Manager"/"IT", "days_after_start": number}], "reasoning": "approach summary"}. Include 5-7 steps.`,
    json: true,
  }),
  suggest_key_results: (ctx) => ({
    prompt: `Suggest 3 measurable key results for this OKR objective: "${ctx.objective || "Improve performance"}". Return JSON: {"key_results": ["KR1", "KR2", "KR3"], "reasoning": "one sentence"}. Make them specific and quantifiable.`,
    json: true,
  }),
  suggest_interview_questions: (ctx) => ({
    prompt: `Suggest 3 interview questions for a "${ctx.job_title || "Software Engineer"}" role. Return JSON: {"questions": ["Q1?", "Q2?", "Q3?"], "reasoning": "one sentence on question selection"}. Mix technical and behavioral.`,
    json: true,
  }),
  suggest_survey_questions: (ctx) => ({
    prompt: `Suggest 3 employee engagement survey questions about "${ctx.topic || "workplace satisfaction"}". Return JSON: {"questions": [{"text": "question text", "type": "rating" or "text" or "multiple_choice", "options": ["opt1", "opt2"] or null}], "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_lead_action: (ctx) => ({
    prompt: `Suggest the next action for a CRM lead. Status: "${ctx.status || "new"}", Days since last activity: ${ctx.days_since_last_activity || 0}. Return JSON: {"action": "specific action to take", "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_account_action: (ctx) => ({
    prompt: `Suggest the next action for a CRM account. Days since last activity: ${ctx.days_since_last_activity || 0}, Contact count: ${ctx.contact_count || 0}. Return JSON: {"action": "specific action to take", "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_deal_next_step: (ctx) => ({
    prompt: `Suggest the next step for a deal. Stage: "${ctx.stage || "prospecting"}", Days since last activity: ${ctx.days_since_last_activity || 0}. Return JSON: {"next_step": "specific action", "due_date": "YYYY-MM-DD", "reasoning": "one sentence"}`,
    json: true,
  }),
  suggest_pipeline_actions: (ctx) => ({
    prompt: `Suggest pipeline actions. Stale deals: ${(ctx.stale_deal_names as string[])?.join(", ") || "none"}, Overdue deals: ${(ctx.overdue_deal_names as string[])?.join(", ") || "none"}, In negotiation: ${(ctx.negotiation_deal_names as string[])?.join(", ") || "none"}. Return JSON: {"actions": [{"action": "what to do", "deal_name": "which deal", "reasoning": "why"}]}. Up to 5 actions, most urgent first.`,
    json: true,
  }),
  suggest_campaign_improvements: (ctx) => ({
    prompt: `Suggest improvements for a ${ctx.type || "email"} campaign. Cost per lead: ${ctx.cost_per_lead ?? "N/A"}, ROI: ${ctx.roi_percent ?? "N/A"}%. Return JSON: {"improvements": [{"suggestion": "what to change", "reasoning": "why", "expected_impact": "expected result"}]}. Suggest 2-3 improvements.`,
    json: true,
  }),
  generate_sprint_plan: (ctx) => {
    const tasks = (ctx.backlog_tasks as { id: string; title: string; estimate: number; priority: string }[]) || [];
    const members = (ctx.team_members as { id: string; name: string; available_hours_per_week: number }[]) || [];
    return {
      prompt: `Generate a sprint plan for project "${ctx.project_name || "Project"}".

Backlog tasks:
${tasks.map((t) => `- "${t.title}" (priority: ${t.priority}, estimate: ${t.estimate}h)`).join("\n") || "- No tasks"}

Team members:
${members.map((m) => `- ${m.name} (${m.available_hours_per_week}h/week available)`).join("\n") || "- No members"}

Return JSON:
{
  "sprint_name": "Sprint N — Theme",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "tasks": [{"title": "task title", "assignee_name": "person name", "estimate": hours, "priority": "high"/"medium"/"low"}],
  "capacity_analysis": {"total_capacity": hours, "total_estimated": hours, "utilization_percent": number, "warnings": ["any warnings"]},
  "reasoning": "one sentence on sprint strategy"
}

Start the sprint next Monday. Assign tasks to team members by balancing workload.`,
      json: true,
    };
  },
};

const monitorPrompts: Record<string, PromptBuilder> = {
  project_health_scan: (ctx) => ({
    prompt: `Assess health for project "${ctx.projectName || "Project"}". Generate realistic project health signals and a summary.

Return JSON:
{
  "signals": {
    "totalTasks": number,
    "openTasks": number,
    "doneTasks": number,
    "overdueTasks": number,
    "blockedTasks": number,
    "sprints": [{"id": "s1", "name": "Sprint N", "status": "active"/"completed"/"planned", "totalTasks": number, "doneTasks": number, "burnRate": 0.0-1.0}]
  },
  "aiSummary": "2-3 sentence health assessment with actionable advice"
}`,
    json: true,
  }),
  flag_attendance_anomalies: (ctx) => {
    const names = (ctx.employee_names as string[]) || [];
    return {
      prompt: `Flag attendance anomalies for these employees: ${names.join(", ") || "none listed"}. Return JSON: {"anomalies": [{"employee_name": "name", "pattern": "description of anomaly"}], "reasoning": "one sentence overview"}. Flag up to 3 people, or empty array if the list is empty.`,
      json: true,
    };
  },
  check_leave_coverage: (ctx) => ({
    prompt: `Check team coverage for a leave request. Overlapping leaves: ${ctx.overlapping_leave_count || 0}, Team size: ${ctx.team_size || 5}. Return JSON: {"coverage_status": "risky" or "good", "overlapping_leave_count": ${ctx.overlapping_leave_count || 0}, "reasoning": "one sentence"}. Flag as risky if >40% of team would be out.`,
    json: true,
  }),
  assess_deal_risk: (ctx) => ({
    prompt: `Assess risk for a CRM deal. Days in current stage: ${ctx.days_in_stage || 0}, Days since last activity: ${ctx.days_since_last_activity || 0}, Past expected close: ${ctx.is_past_due || false}, Stage: "${ctx.stage || "prospecting"}". Return JSON: {"risk_level": "low"/"medium"/"high", "reasoning": "one sentence", "suggested_actions": ["action1", "action2"]}`,
    json: true,
  }),
};

const PROMPT_MAP: Record<string, Record<string, PromptBuilder>> = {
  Writer: writerPrompts,
  Analyst: analystPrompts,
  Planner: plannerPrompts,
  Monitor: monitorPrompts,
};

export function buildPrompt(agent: string, task: string, context: MockContext): { prompt: string; json: boolean } | null {
  return PROMPT_MAP[agent]?.[task]?.(context) ?? null;
}

"use client";

import { Card } from "@/components/ui/Card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-950">Automations</h1>
        <p className="text-body text-neutral-500">Create rules to automate repetitive workflows across your organization.</p>
      </div>

      <Card>
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <svg className="h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </EmptyMedia>
            <EmptyTitle>Coming soon</EmptyTitle>
            <EmptyDescription>
              Automations will let you define triggers, conditions, and actions to streamline work — like auto-assigning tasks, escalating overdue items, or notifying teams on status changes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}

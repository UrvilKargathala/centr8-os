"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrg } from "@/lib/context/OrgContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Field } from "@/components/ui/Input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/Empty";

type Holiday = { id: string; date: string; name: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function HolidaysPage() {
  const { selectedOrgId, can, loading: orgLoading } = useOrg();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  function loadAll() {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/holidays?org_id=${selectedOrgId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!body.data) throw new Error(body.error ?? "Failed to load holidays");
        setHolidays(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load holidays"))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [selectedOrgId]);

  const today = todayIso();
  const sorted = useMemo(
    () =>
      holidays
        .filter((h) => h.name.toLowerCase().includes(search.toLowerCase()))
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, search],
  );

  if (orgLoading || loading) return <p className="text-body text-neutral-600">Loading holidays…</p>;
  if (!selectedOrgId) return <p className="text-body text-neutral-600">No organization selected.</p>;
  if (error) return <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-display font-semibold text-neutral-950">Holidays</h1>
        {can("holiday", "create") && <Button onClick={() => setShowNew(true)}>+ Add New Holiday</Button>}
      </div>

      <Card padding="sm">
        <div className="border-b border-neutral-200 p-3">
          <div className="relative max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <Input
              className="w-full pl-9"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {sorted.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </EmptyMedia>
              <EmptyTitle>{holidays.length === 0 ? "No holidays yet" : "No holidays match your search"}</EmptyTitle>
              <EmptyDescription>
                {holidays.length === 0 ? "Add the first holiday to build out the calendar." : "Try a different search term."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y divide-neutral-200">
            {sorted.map((h) => {
              const upcoming = h.date >= today;
              return (
                <div key={h.id} className="flex flex-col gap-1 py-3 pl-3 pr-4 sm:flex-row sm:items-center sm:gap-4">
                  <div
                    className={`shrink-0 border-l-2 pl-3 text-body sm:w-40 ${upcoming ? "border-primary-600" : "border-neutral-200"}`}
                  >
                    {new Date(h.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "long",
                      day: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                  <div className="pl-3 text-small text-neutral-600 sm:w-24 sm:pl-0 sm:text-body">
                    {new Date(h.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" })}
                  </div>
                  <div className="pl-3 text-body text-neutral-950 sm:flex-1 sm:pl-0">{h.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-4 text-small text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary-600" /> Upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-300" /> Past Holidays
        </span>
      </div>

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <NewHolidayForm
            orgId={selectedOrgId}
            onClose={() => setShowNew(false)}
            onCreated={() => {
              setShowNew(false);
              loadAll();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function NewHolidayForm({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !name) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, date, name }),
    });
    const body = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(body.error ?? "Failed to add holiday");
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-h2 font-semibold text-neutral-950">Add New Holiday</h2>

      {error && <p className="rounded-md bg-danger-100 p-3 text-body text-danger-600">{error}</p>}

      <Field label="Date">
        <Input type="date" className="w-full" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
      </Field>
      <Field label="Holiday name">
        <Input className="w-full" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !date || !name}>
          {saving ? "Adding…" : "Add Holiday"}
        </Button>
      </div>
    </form>
  );
}

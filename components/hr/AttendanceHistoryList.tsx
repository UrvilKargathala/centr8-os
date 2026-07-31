"use client";

// Shared recent-history table — used by /hr/attendance (My Attendance
// view) and the Employee Detail Attendance tab.
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { isLate, type AttendanceRecord, type AttendanceSettings } from "@/components/hr/AttendanceCalendar";

export function AttendanceHistoryList({ history, settings }: { history: AttendanceRecord[]; settings: AttendanceSettings }) {
  return (
    <div>
      <h2 className="mb-3 text-h3 font-semibold text-neutral-950">Recent history</h2>
      {history.length === 0 ? (
        <p className="text-body text-neutral-600">No attendance recorded yet.</p>
      ) : (
        <Card padding="sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Total hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => {
                const late = isLate(r, settings);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.workDate}</TableCell>
                    <TableCell className="text-neutral-600">
                      {late && (
                        <span title="Late arrival" className="mr-1 text-warning-600">
                          ⚠
                        </span>
                      )}
                      {r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : "—"}
                    </TableCell>
                    <TableCell className="text-neutral-600">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell className="text-neutral-600">{r.totalMinutes != null ? (r.totalMinutes / 60).toFixed(1) : "—"}</TableCell>
                    <TableCell>
                      <Badge>{r.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-neutral-600">{r.location?.replace(/_/g, " ") ?? "—"}</TableCell>
                    <TableCell className="max-w-[10rem] truncate text-neutral-600">{[r.checkInNote, r.checkOutNote].filter(Boolean).join(" · ") || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

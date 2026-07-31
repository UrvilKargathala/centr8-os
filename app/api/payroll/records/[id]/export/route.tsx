import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, organizations, payslipRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireCompensationViewAccess } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string }> };

// react-pdf per CLAUDE.md's stack — genuinely rendered server-side, not a
// stub. Explicitly labeled "Compensation Summary — Not a Tax Document" in
// the output itself, not just in the surrounding UI, so the file still
// carries the disclaimer if it's saved or forwarded on its own.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#5B5F68", marginBottom: 20 },
  disclaimer: { fontSize: 9, color: "#B4740E", marginBottom: 20, borderLeft: "3pt solid #B4740E", paddingLeft: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottom: "0.5pt solid #E5E7EB" },
  label: { color: "#5B5F68" },
  value: { fontWeight: 700 },
  section: { marginTop: 16 },
});

function PayslipDocument({
  orgName,
  employeeName,
  record,
}: {
  orgName: string;
  employeeName: string;
  record: typeof payslipRecords.$inferSelect;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Compensation Summary — Not a Tax Document</Text>
        <Text style={styles.subtitle}>{orgName}</Text>

        <View style={styles.disclaimer}>
          <Text>
            This is a structured record-keeping summary only. It does not calculate taxes, statutory deductions
            (PF/ESI/TDS), or represent an actual payment. Consult a payroll/tax professional for compliance.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Employee</Text>
            <Text style={styles.value}>{employeeName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {record.periodStart} to {record.periodEnd}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{record.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Gross amount</Text>
            <Text style={styles.value}>
              {record.currency} {record.grossAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total deductions</Text>
            <Text style={styles.value}>
              {record.currency} {record.totalDeductions.toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Net amount</Text>
            <Text style={styles.value}>
              {record.currency} {record.netAmount.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontSize: 8, color: "#9CA3AF" }}>
            Generated {new Date(record.generatedAt).toLocaleString()} · Centr8 OS
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const data = await withOrgContext(userId, async (db) => {
      const [record] = await db.select().from(payslipRecords).where(eq(payslipRecords.id, id));
      if (!record) return undefined;
      await requireCompensationViewAccess(db, userId, record.orgId);

      const [employee] = await db.select({ fullName: employees.fullName }).from(employees).where(eq(employees.id, record.employeeId));
      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, record.orgId));
      return { record, employeeName: employee?.fullName ?? "Unknown", orgName: org?.name ?? "" };
    });
    if (!data) throw new ApiError(404, "Payslip record not found");

    const buffer = await renderToBuffer(<PayslipDocument orgName={data.orgName} employeeName={data.employeeName} record={data.record} />);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compensation-summary-${data.record.periodStart}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { withOrgContext } from "@/db/withOrgContext";
import { generatedDocuments, organizations } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Reuses the react-pdf setup from the Payroll export route. Markdown
// content is rendered as plain paragraphs — react-pdf has no markdown
// renderer, and a full markdown-to-PDF layer is out of scope for what's
// meant to be a clean, readable export, not a styled document editor.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#5B5F68", marginBottom: 4 },
  meta: { fontSize: 8, color: "#9CA3AF", marginBottom: 20 },
  line: { marginBottom: 6, lineHeight: 1.4 },
  heading: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4 },
});

function DocPdf({ orgName, doc }: { orgName: string; doc: typeof generatedDocuments.$inferSelect }) {
  const lines = doc.content.split("\n");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.subtitle}>{orgName}</Text>
        <Text style={styles.meta}>
          {doc.docType.replace(/_/g, " ")} · {doc.status} · generated {new Date(doc.createdAt).toLocaleString()}
        </Text>
        {lines.map((line, i) => {
          const heading = line.match(/^#{1,6}\s+(.*)/);
          const text = heading ? heading[1] : line.replace(/^[-*]\s+/, "• ").trim();
          if (!text) return null;
          return (
            <Text key={i} style={heading ? styles.heading : styles.line}>
              {text}
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const data = await withOrgContext(userId, async (db) => {
      const [doc] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, id));
      if (!doc) return undefined;
      await requirePermission(db, userId, doc.orgId, "document", "read");
      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, doc.orgId));
      return { doc, orgName: org?.name ?? "" };
    });
    if (!data) throw new ApiError(404, "Document not found");

    const buffer = await renderToBuffer(<DocPdf orgName={data.orgName} doc={data.doc} />);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.doc.docType}-${data.doc.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

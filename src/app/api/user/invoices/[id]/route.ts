import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { getInvoiceForUser, renderInvoicePdf } from "@/lib/billing/invoice.service";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardSensitiveReadOrigin } from "@/lib/server/mutation-origin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const originBlocked = guardSensitiveReadOrigin(request);
  if (originBlocked) return originBlocked;

  const auth = await tryGetApiUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await context.params;
  const invoice = await getInvoiceForUser(user.id, id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const pdfBytes = await renderInvoicePdf({
    invoice_number: invoice.invoice_number,
    amount_paise: invoice.amount_paise,
    tax_paise: invoice.tax_paise,
    issued_at: invoice.issued_at,
    billing_name: invoice.billing_name,
    billing_email: invoice.billing_email,
    line_items: invoice.line_items as Array<{ description?: string; amount_paise?: number }>,
    gstin_seller: invoice.gstin_seller,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createServiceClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/db/queries";
import { APP_NAME } from "@/config/constants";

const GST_RATE = Number(process.env.BILLING_GST_RATE ?? "18") / 100;

function splitGstInclusive(totalPaise: number): { taxablePaise: number; taxPaise: number } {
  const taxPaise = Math.round(totalPaise - totalPaise / (1 + GST_RATE));
  return { taxablePaise: totalPaise - taxPaise, taxPaise };
}

async function nextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number");
  if (!error && typeof data === "string" && data.trim()) {
    return data.trim();
  }

  const year = new Date().getFullYear();
  const prefix = `OMP-${year}-`;
  const { data: last } = await supabase
    .from("billing_invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastSeq = Number(String(last?.invoice_number ?? "").split("-").at(-1));
  const seq = String((Number.isFinite(lastSeq) ? lastSeq : 0) + 1).padStart(5, "0");
  return `${prefix}${seq}`;
}

export async function issueGstInvoiceForPayment(input: {
  userId: string;
  paymentId: string;
  amountPaise: number;
  razorpayPaymentId?: string | null;
  planLabel: string;
  organizationId?: string | null;
}): Promise<{ invoiceId: string; invoiceNumber: string }> {
  if (input.amountPaise <= 0) {
    throw new Error("Invalid invoice amount");
  }

  const profile = await getUserProfile(input.userId);
  const { taxablePaise, taxPaise } = splitGstInclusive(input.amountPaise);
  const sellerGstin = process.env.BILLING_GSTIN?.trim() || null;

  const lineItems = [
    {
      description: input.planLabel,
      amount_paise: input.amountPaise,
      taxable_paise: taxablePaise,
      tax_paise: taxPaise,
    },
  ];

  const supabase = await createServiceClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const invoiceNumber = await nextInvoiceNumber(supabase);
    const { data, error } = await supabase
      .from("billing_invoices")
      .insert({
        user_id: input.userId,
        payment_id: input.paymentId,
        organization_id: input.organizationId ?? null,
        invoice_number: invoiceNumber,
        razorpay_payment_id: input.razorpayPaymentId ?? null,
        amount_paise: input.amountPaise,
        tax_paise: taxPaise,
        gstin_seller: sellerGstin,
        billing_name: profile?.full_name ?? null,
        billing_email: profile?.email ?? null,
        line_items: lineItems,
        status: "paid",
      })
      .select("id, invoice_number")
      .single();

    if (!error && data) {
      return { invoiceId: data.id, invoiceNumber: data.invoice_number };
    }
    if (error?.code !== "23505") throw error;
  }

  throw new Error("Could not allocate a unique invoice number");
}

export async function listUserInvoices(userId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, amount_paise, tax_paise, status, issued_at, razorpay_payment_id"
    )
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getInvoiceForUser(userId: string, invoiceId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function renderInvoicePdf(invoice: {
  invoice_number: string;
  amount_paise: number;
  tax_paise: number;
  issued_at: string;
  billing_name?: string | null;
  billing_email?: string | null;
  line_items: Array<{ description?: string; amount_paise?: number }>;
  gstin_seller?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const sellerName = process.env.BILLING_LEGAL_NAME?.trim() || APP_NAME;
  const sellerGstin = invoice.gstin_seller ?? process.env.BILLING_GSTIN?.trim() ?? "—";
  const amountInr = (invoice.amount_paise / 100).toFixed(2);
  const taxInr = (invoice.tax_paise / 100).toFixed(2);
  const taxableInr = ((invoice.amount_paise - invoice.tax_paise) / 100).toFixed(2);

  let y = 780;
  const draw = (text: string, size = 11, useBold = false) => {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 8;
  };

  draw("TAX INVOICE", 18, true);
  draw(`Invoice #: ${invoice.invoice_number}`, 12, true);
  draw(`Date: ${new Date(invoice.issued_at).toLocaleDateString("en-IN")}`);
  y -= 8;
  draw(`Seller: ${sellerName}`, 11, true);
  draw(`GSTIN: ${sellerGstin}`);
  y -= 8;
  draw(`Bill To: ${invoice.billing_name ?? "Customer"}`);
  draw(`Email: ${invoice.billing_email ?? "—"}`);
  y -= 12;

  const line = invoice.line_items[0];
  draw(`Description: ${line?.description ?? "Pro subscription"}`);
  draw(`Taxable value: ₹${taxableInr}`);
  draw(`GST (${Math.round(GST_RATE * 100)}%): ₹${taxInr}`);
  draw(`Total: ₹${amountInr}`, 14, true);
  draw("This is a computer-generated invoice.", 9);

  return pdf.save();
}

// ── send-quote-email Edge Function ──────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function buildEmailHtml(recipientName: string, referenceNumber: string, recipientPhone?: string): string {
  const phoneRow = recipientPhone ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0">
          <span style="font-size:12px;color:#64748b">Phone</span>
          <span style="font-size:13px;color:#1e293b">${recipientPhone}</span>
        </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f9">
<div style="background:#f0f4f9;padding:32px 16px;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">

    <!-- Header -->
    <div style="background:#0f1f3d;padding:26px 36px">
      <img src="https://www.invntree.com/wp-content/uploads/2026/05/Invntree-Logo-LowRes-White-NoBG-LS.png"
           alt="InvnTree"
           style="height:38px;width:auto;display:block;margin-bottom:6px"
           height="38">
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55)">Fee Quotation</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px">

      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Dear ${recipientName},</p>

      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#1e293b">
        Thank you for using the InvnTree fee calculator. Please find your personalised fee quotation attached to this email.
      </p>

      <!-- Reference card -->
      <div style="background:#f8fafd;border-radius:8px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid #e2e8f0">
          <span style="font-size:12px;color:#64748b">Reference number</span>
          <span style="font-size:13px;font-weight:500;background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:6px">${referenceNumber}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <span style="font-size:12px;color:#64748b">Document</span>
          <span style="font-size:13px;color:#1e293b">Fee Schedule (PDF)</span>
        </div>
        ${phoneRow}
      </div>

      <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#64748b">
        Please note that this estimate is indicative and subject to revision based on the specific requirements of your matter. Our team will be happy to walk you through the details.
      </p>

      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7">
        If you have any questions, feel free to reach out to us at
        <a href="mailto:contact@invntree.com" style="color:#1FA0E0;text-decoration:none">contact@invntree.com</a>
        or call us at <span style="color:#1e293b;font-weight:500">+91 98451 73455</span>.
      </p>

    </div>

    <!-- Divider -->
    <div style="height:1px;background:#e2e8f0;margin:0 36px"></div>

    <!-- Footer -->
    <div style="padding:20px 36px">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td valign="middle">
          <p style="margin:0;font-size:11px;color:#94a3b8">© 2026 InvnTree IP Services. All rights reserved.</p>
        </td>
        <td align="right" valign="middle">
          <a href="https://www.linkedin.com/company/invntree" style="font-size:11px;color:#94a3b8;text-decoration:none;margin-left:14px">LinkedIn</a>
          <a href="https://invntree.com" style="font-size:11px;color:#94a3b8;text-decoration:none;margin-left:14px">Website</a>
        </td>
      </tr></table>
    </div>

  </div>
</div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { to, recipient_name, recipient_phone, quote_html, user_id, calculator_type,
            title, grand_total, client_name, state } = body

    console.log('send-quote-email: invoked for', to, 'calc_type:', calculator_type)

    if (!to || !quote_html || !user_id) {
      console.error('Missing required fields')
      return new Response(JSON.stringify({ error: 'Missing required fields: to, quote_html, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const GOTENBERG_URL  = Deno.env.get('GOTENBERG_URL')
    const ADMIN_EMAIL    = Deno.env.get('ADMIN_NOTIFY_EMAIL')
    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')
    const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set')
      return new Response(JSON.stringify({ error: 'Email service not configured. Contact admin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!GOTENBERG_URL) {
      console.error('GOTENBERG_URL not set')
      return new Response(JSON.stringify({ error: 'PDF service not configured. Contact admin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(SUPABASE_URL!, SERVICE_KEY!)

    // ── Rate limiting ─────────────────────────────────────────────
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await adminClient
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .not('reference_number', 'is', null)
      .gte('created_at', since)

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Daily email limit of 5 reached. Please contact InvnTree to send more quotes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Generate quote reference ──────────────────────────────────
    const { data: refData } = await adminClient.rpc('generate_quote_reference')
    const referenceNumber = refData ?? `INV-${new Date().getFullYear()}-XXXX`
    console.log('Reference:', referenceNumber)

    // ── Convert HTML → PDF via Gotenberg ─────────────────────────
    console.log('Calling Gotenberg at:', GOTENBERG_URL)
    let quotePdfBytes: Uint8Array
    try {
      const formData = new FormData()
      formData.append('files', new Blob([quote_html], { type: 'text/html' }), 'index.html')
      const gResp = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
        method: 'POST', body: formData,
      })
      if (!gResp.ok) {
        const errText = await gResp.text()
        console.error('Gotenberg error:', errText)
        throw new Error(`PDF generation failed: ${gResp.status}`)
      }
      quotePdfBytes = new Uint8Array(await gResp.arrayBuffer())
      console.log('PDF generated, bytes:', quotePdfBytes.length)
    } catch (e) {
      console.error('Gotenberg fetch failed:', e.message)
      return new Response(JSON.stringify({ error: 'PDF generation failed. Please check Railway service is running.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Try to append brochure (non-fatal if missing) ─────────────
    let finalPdfBase64: string
    try {
      const { data: setting } = await adminClient
        .from('settings').select('value').eq('key', 'brochure_url').single()

      if (setting?.value) {
        const brochureResp = await fetch(setting.value)
        if (brochureResp.ok) {
          const brochureBytes = new Uint8Array(await brochureResp.arrayBuffer())
          const merged = await PDFDocument.create()
          const qDoc = await PDFDocument.load(quotePdfBytes)
          const bDoc = await PDFDocument.load(brochureBytes)
          const qPages = await merged.copyPages(qDoc, qDoc.getPageIndices())
          qPages.forEach(p => merged.addPage(p))
          const bPages = await merged.copyPages(bDoc, bDoc.getPageIndices())
          bPages.forEach(p => merged.addPage(p))
          finalPdfBase64 = uint8ToBase64(await merged.save())
          console.log('Brochure appended successfully')
        } else {
          finalPdfBase64 = uint8ToBase64(quotePdfBytes)
        }
      } else {
        finalPdfBase64 = uint8ToBase64(quotePdfBytes)
      }
    } catch (e) {
      console.error('Brochure merge failed (non-fatal):', e.message)
      finalPdfBase64 = uint8ToBase64(quotePdfBytes)
    }

    // ── Build email ───────────────────────────────────────────────
    const recipientName = recipient_name || client_name || 'Client'
    const subject = `InvnTree Fee Quote – ${recipientName}`
    const emailHtml = buildEmailHtml(recipientName, referenceNumber, recipient_phone)

    // ── Send via Resend ───────────────────────────────────────────
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'InvnTree Fees <fees@invntree.com>',
        to: [to],
        subject,
        html: emailHtml,
        attachments: [{
          filename: `${referenceNumber}.pdf`,
          content: finalPdfBase64,
        }],
      }),
    })

    if (!resendResp.ok) {
      const errBody = await resendResp.text()
      console.error('Resend error:', errBody)
      return new Response(JSON.stringify({ error: 'Email delivery failed: ' + errBody }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log('Email sent successfully')

    // ── Save quote record ─────────────────────────────────────────
    await adminClient.from('quotes').insert({
      user_id,
      reference_number: referenceNumber,
      calculator_type,
      title: title || subject,
      recipient_email: to,
      recipient_name: recipientName,
      grand_total,
      state,
      sent_at: new Date().toISOString(),
    })

    // ── Admin notification (fire-and-forget) ──────────────────────
    if (ADMIN_EMAIL) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'InvnTree Notifications <fees@invntree.com>',
          to: [ADMIN_EMAIL],
          subject: `[InvnTree] Quote sent — ${referenceNumber}`,
          html: `<p style="font-family:sans-serif;font-size:14px">Quote <strong>${referenceNumber}</strong> sent to <strong>${to}</strong> (${recipientName}) by user <strong>${user_id}</strong>.<br>Calculator: ${calculator_type} · Total: ₹${grand_total?.toLocaleString('en-IN') ?? 'N/A'}</p>`,
        }),
      }).catch(() => {})
    }

    return new Response(JSON.stringify({ success: true, reference: referenceNumber }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Unhandled error:', err.message, err.stack)
    return new Response(JSON.stringify({ error: 'Internal error: ' + err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

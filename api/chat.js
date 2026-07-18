// api/chat.js
// Vercel serverless function — runs the Hawaii Solar Outfitters intake agent.
// Deploy this whole project to Vercel (see README.md for step-by-step).

const SYSTEM_PROMPT = `You are the intake assistant for Hawaii Solar Outfitters, a solar installation
contractor serving East Hawaii (Hilo side) on the Big Island of Hawaii.

ABOUT THE BUSINESS
- Single, experienced contractor (8-15 years experience), no sales team, no commissions
- SPECIALTY: off-grid solar systems — no HELCO interconnection queue, no county permitting delay.
  This is the primary offer and what most jobs are. Ideal for ag-zoned, unpermitted, or fully
  off-grid East Hawaii/Puna properties.
- Grid-tied (HELCO-interconnected) systems are also available on request, but off-grid is the lead
  offer and the faster, easier job — steer the conversation there first unless the visitor makes
  clear they specifically want/need grid-tied.
- Positioning: "No permits, no pressure. No sales team. Just solar, done fast." Direct owner
  accountability from quote to final inspection — the customer works with the actual installer,
  not a rep.
- Service area: East Hawaii / Hilo side (Hilo, Keaau, Pahoa, Mountain View, Honomu, Kurtistown, etc.)
- Cash or customer-financed (loan) projects only — no in-house financing offered.

YOUR JOB
1. Greet the visitor warmly and briefly (1-2 sentences), no corporate tone.
2. Naturally gather these qualifying details through conversation, NOT as a rigid interrogation —
   ask one or two things at a time, respond to what they say first:
   - Do they own the property (not renting)?
   - Is the property currently on-grid (HELCO connected) or off-grid/no grid access? Is it
     permitted, unpermitted, or ag-zoned? (This determines which service — off-grid or grid-tied —
     actually fits, and it's the single most important qualifying question for this business.)
   - What's the property used for / expected load — small cabin/ohana (lights, fridge, water pump)
     vs. full-time home (AC, appliances, etc.) vs. larger homestead (well pump, workshop, heavy use)?
   - Timeline (just researching vs. ready to move in next few months)
   - Cash purchase or planning to finance through their own loan/bank?
3. Based on their load needs, you can mention which tier roughly fits (Basic Off-Grid, Off-Grid
   Home, or Full Homestead) but make clear final sizing comes from the site visit. If their load
   sounds like it's near the boundary between a smaller and larger system, gently note that a
   slightly larger battery often pays off for storm-season reliability — but don't pressure.
4. Ask for name, phone number, and email so the contractor can follow up.
5. Once you have: name, phone/email, homeowner status, on-grid/off-grid/permitting status, load
   profile, and timeline — call the submit_lead tool with that information.
6. After calling submit_lead, tell the visitor a real person will reach out within one business day
   to schedule a free, no-pressure site visit, and thank them.

TONE
Warm, direct, conversational — like texting a knowledgeable neighbor, not a corporate chatbot.
Short messages. No emojis. No exclamation-point-heavy enthusiasm. If asked about pricing, give
honest general ranges by tier (Basic Off-Grid roughly $14k-19k, Off-Grid Home roughly $28k-35k,
Full Homestead roughly $40k-50k) but make clear final pricing comes from the actual site visit,
and these ranges are illustrative until confirmed.

If asked about tax credits: the federal 30% credit expired December 31, 2025. Hawaii's state
credit (35% of cost, up to $5,000) is still available in 2026 but is being phased down before a
2030 sunset — worth acting on sooner rather than later, framed honestly, not as false urgency.
Note that off-grid systems may have different incentive eligibility than grid-tied systems since
some programs require utility interconnection — tell the visitor a real person will confirm
their specific eligibility, don't guess.

Never fabricate specific pricing, availability dates, or promises about permitting timelines —
say a real person will confirm specifics.`;

const SUBMIT_LEAD_TOOL = {
  name: "submit_lead",
  description: "Call this once you have gathered enough information to hand off a qualified lead to the contractor.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      phone: { type: "string" },
      email: { type: "string" },
      homeowner: { type: "boolean", description: "True if they confirmed they own the property" },
      grid_status: { type: "string", description: "e.g. 'off-grid, no HELCO access', 'on-grid, wants to go off-grid', 'grid-tied requested'" },
      permit_status: { type: "string", description: "e.g. 'unpermitted structure', 'ag-zoned', 'permitted home', 'not sure'" },
      load_profile: { type: "string", description: "e.g. 'small cabin - lights/fridge/water pump', 'full-time home', 'homestead with well pump/workshop'" },
      timeline: { type: "string", description: "e.g. 'ready to move in the next month', 'just researching'" },
      notes: { type: "string", description: "Any other relevant context from the conversation" }
    },
    required: ["name", "phone", "homeowner", "grid_status", "load_profile", "timeline"]
  }
};

async function sendLeadEmail(lead) {
  // Uses Resend (https://resend.com) — free tier is plenty for a solo operator.
  // Set RESEND_API_KEY and NOTIFY_EMAIL in your Vercel project's Environment Variables.
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) {
    console.error("Missing RESEND_API_KEY or NOTIFY_EMAIL env vars — skipping email send.");
    return;
  }

  const html = `
    <h2>New qualified lead — Hawaii Solar Outfitters</h2>
    <p><strong>Name:</strong> ${lead.name || "-"}</p>
    <p><strong>Phone:</strong> ${lead.phone || "-"}</p>
    <p><strong>Email:</strong> ${lead.email || "-"}</p>
    <p><strong>Homeowner:</strong> ${lead.homeowner ? "Yes" : "No"}</p>
    <p><strong>Grid status:</strong> ${lead.grid_status || "-"}</p>
    <p><strong>Permit status:</strong> ${lead.permit_status || "-"}</p>
    <p><strong>Load profile:</strong> ${lead.load_profile || "-"}</p>
    <p><strong>Timeline:</strong> ${lead.timeline || "-"}</p>
    <p><strong>Notes:</strong> ${lead.notes || "-"}</p>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Hawaii Solar Outfitters Intake <onboarding@resend.dev>",
      to: [notifyEmail],
      subject: `New lead: ${lead.name || "Unnamed"} — ${lead.grid_status || "solar inquiry"}`,
      html
    })
  });
}

module.exports = async (req, res) => {
  // Basic CORS so the widget can call this from your Squarespace/Wix domain.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server misconfigured: missing ANTHROPIC_API_KEY" });

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages array required" });

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages,
        tools: [SUBMIT_LEAD_TOOL]
      })
    });

    const data = await anthropicRes.json();

    if (data.error) {
      console.error("Anthropic API error:", data.error);
      return res.status(500).json({ error: "Upstream API error" });
    }

    // Check if the model called submit_lead
    const toolUse = (data.content || []).find(block => block.type === "tool_use" && block.name === "submit_lead");
    if (toolUse) {
      await sendLeadEmail(toolUse.input);
    }

    // Extract plain text to send back to the widget
    const text = (data.content || [])
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    return res.status(200).json({
      reply: text || "Got it — let me make sure that reaches the right person, one moment.",
      leadCaptured: !!toolUse,
      raw: data.content // useful for debugging / extending later
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

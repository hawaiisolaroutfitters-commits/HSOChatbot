// api/chat.js
// Vercel serverless function — runs the Hawaii Solar Outfitters intake agent.
// Deploy this whole project to Vercel (see README.md for step-by-step).

const SYSTEM_PROMPT = `You are the intake assistant for Hawaii Solar Outfitters, a solar installation
contractor serving East Hawaii (Hilo side) on the Big Island of Hawaii.

ABOUT THE BUSINESS
- Single, experienced contractor (10 years experience), no sales team, no commissions
- TWO SERVICE PATHS, both under off-grid specialization:
  1. NEW OFF-GRID INSTALLS — no HELCO interconnection queue, no county permitting delay. Ideal
     for ag-zoned, unpermitted, or fully off-grid East Hawaii/Puna properties.
  2. OFF-GRID SYSTEM HEALTH CHECK — a free diagnostic visit for existing off-grid systems that
     are underperforming (generator running too much, batteries not holding charge, etc). Uses a
     real battery load tester and site analysis to give the customer actual numbers before
     recommending anything. Free visit; only paid if they choose to move forward with an upgrade.
- Grid-tied (HELCO-interconnected) systems are also available on request, but off-grid — both new
  builds and diagnostics/upgrades — is the lead offer.
- Positioning: "No permits, no pressure. I test before I recommend." Direct owner accountability
  from quote to final inspection — the customer works with the actual installer, not a rep.
- Service area: East Hawaii / Hilo side (Hilo, Keaau, Pahoa, Mountain View, Honomu, Kurtistown, etc.)
- Cash or customer-financed (loan) projects only — no in-house financing offered.

YOUR JOB
1. Greet the visitor warmly and briefly (1-2 sentences), no corporate tone.
2. Early in the conversation, figure out which path fits: are they building/planning a NEW system,
   or do they have an EXISTING off-grid system that's underperforming (generator running a lot,
   batteries degraded, not enough power)? This determines everything downstream — ask naturally,
   don't make it feel like a menu.
3a. IF NEW INSTALL: naturally gather these details through conversation, one or two things at a
   time, responding to what they say first:
   - Do they own the property (not renting)?
   - Is the property currently on-grid (HELCO connected) or off-grid/no grid access? Is it
     permitted, unpermitted?
   - What's the property used for / expected load — small cabin/ohana (lights, fridge, water pump)
     vs. full-time home (AC, appliances, etc.) vs. larger homestead (well pump, workshop, heavy use)?
   - Timeline (just researching vs. ready to move in next few months)
   - Cash purchase or planning to finance through their own loan/bank?
   Based on load needs, you can mention which tier roughly fits (Basic Off-Grid, Off-Grid Home,
   or Full Homestead) but make clear final sizing comes from the site visit.
3b. IF EXISTING SYSTEM / DIAGNOSTIC: naturally gather:
   - How old is the current system, roughly, and what's it made of if they know (panels, battery
     brand/type, inverter)?
   - What's going wrong — generator running more than expected, batteries not holding charge,
     not enough power for current needs, or something else?
   - How often do they run the generator now (rough estimate — daily, few times a week, etc.)?
   - Timeline for wanting this looked at.
   Reassure them the health check is free with no obligation, and that you'll bring a real load
   tester and give them actual numbers, not a sales pitch.
4. Ask for name, phone number, and email so the contractor can follow up.
5. Once you have: name, phone/email, homeowner status, which path (new install or diagnostic), and
   the relevant details above for that path — call the submit_lead tool with that information.
6. After calling submit_lead, tell the visitor a real person will reach out within one business day
   to schedule the free site visit or health check, and thank them.

TONE
Warm, direct, conversational — like texting a knowledgeable neighbor, not a corporate chatbot.
Short messages. No emojis. No exclamation-point-heavy enthusiasm. If asked about pricing, give
honest general ranges by tier (Basic Off-Grid roughly $10k-19k, Off-Grid Home roughly $22k-30k,
Full Homestead roughly $35k-45k; System Health Check is free) but make clear final pricing comes
from the actual site visit, and these ranges are illustrative until confirmed.

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
      inquiry_type: { type: "string", enum: ["new_install", "diagnostic_retrofit", "grid_tied"] },
      grid_status: { type: "string", description: "e.g. 'off-grid, no HELCO access', 'on-grid, wants to go off-grid', 'grid-tied requested'" },
      permit_status: { type: "string", description: "e.g. 'unpermitted structure', 'ag-zoned', 'permitted home', 'not sure' — for new installs" },
      load_profile: { type: "string", description: "e.g. 'small cabin - lights/fridge/water pump', 'full-time home', 'homestead with well pump/workshop' — for new installs" },
      existing_system_details: { type: "string", description: "For diagnostic/retrofit: system age, known equipment brands, symptoms, generator usage frequency" },
      timeline: { type: "string", description: "e.g. 'ready to move in the next month', 'just researching'" },
      notes: { type: "string", description: "Any other relevant context from the conversation" }
    },
    required: ["name", "phone", "homeowner", "inquiry_type", "timeline"]
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

      // The model's response so far only contains the tool call itself — it hasn't
      // actually said anything to the visitor yet. We need a second round-trip:
      // send back a tool_result confirming the lead was received, so the model can
      // generate the actual thank-you/closing message.
      const followUpMessages = [
        ...messages,
        { role: "assistant", content: data.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: "Lead received and forwarded to the contractor."
            }
          ]
        }
      ];

      const followUpRes = await fetch("https://api.anthropic.com/v1/messages", {
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
          messages: followUpMessages,
          tools: [SUBMIT_LEAD_TOOL]
        })
      });

      const followUpData = await followUpRes.json();

      if (followUpData.error) {
        console.error("Anthropic API error (follow-up):", followUpData.error);
        // Lead email already sent successfully at this point — still confirm to the visitor.
        return res.status(200).json({
          reply: "Thanks — that's all been sent over, and someone will reach out within one business day to schedule your free site visit.",
          leadCaptured: true
        });
      }

      const followUpText = (followUpData.content || [])
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n");

      return res.status(200).json({
        reply: followUpText || "Thanks — that's all been sent over, and someone will reach out within one business day to schedule your free site visit.",
        leadCaptured: true,
        raw: followUpData.content
      });
    }

    // No tool call this turn — extract plain text to send back to the widget
    const text = (data.content || [])
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    return res.status(200).json({
      reply: text || "Got it — let me make sure that reaches the right person, one moment.",
      leadCaptured: false,
      raw: data.content
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

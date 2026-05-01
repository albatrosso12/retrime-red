import { Router, type IRouter } from "express";
import { SubmitAppealBody, SubmitAppealResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/appeals", async (req, res) => {
  // Use env variable or fallback to the Cloudflare Worker URL
  const webhook = process.env.ZAPIER_WEBHOOK_URL || "https://retrime.workers.dev";
  if (!webhook) {
    req.log.error("ZAPIER_WEBHOOK_URL is not configured");
    res.status(503).json({
      error: "Webhook is not configured",
      details:
        "Server is missing ZAPIER_WEBHOOK_URL environment variable",
    });
    return;
  }

  const parsed = SubmitAppealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      details: parsed.error.message,
    });
    return;
  }

  const body = parsed.data;
  const forwardedAt = new Date().toISOString();

  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "balkan-rules",
        chatId: body.chatId,
        title: body.title,
        nickname: body.nickname,
        faction: body.faction,
        contact: body.contact,
        category: body.category,
        message: body.message,
        forwardedAt,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      req.log.error(
        { status: upstream.status, body: text },
        "Zapier webhook returned non-ok status",
      );
      res.status(502).json({
        error: "Upstream webhook failed",
        details: `Zapier responded with ${upstream.status}`,
      });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Failed to forward appeal to Zapier");
    res.status(500).json({
      error: "Failed to forward appeal",
      details: err instanceof Error ? err.message : "Unknown error",
    });
    return;
  }

  const data = SubmitAppealResponse.parse({
    ok: true,
    chatId: body.chatId,
    forwardedAt,
  });
  res.json(data);
});

export default router;

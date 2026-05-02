import { Router, type IRouter } from "express";
import { SubmitAppealBody, SubmitAppealResponse, Appeal } from "@workspace/api-zod";
import { appealsTable, usersTable, type Appeal } from "@workspace/db";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db"; // You'll need to export db from the db package

const router: IRouter = Router();

router.post("/appeals", async (req, res) => {
  const webhook = process.env.ZAP_URL || process.env.ZAPIER_WEBHOOK_URL;
  if (!webhook) {
    req.log.error("ZAPIER_WEBHOOK_URL is not configured");
    res.status(503).json({
      error: "Webhook is not configured",
      details: "Server is missing ZAPIER_WEBHOOK_URL environment variable",
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
    // Check if this is "Аппеляция на наказание" - send directly to admin
    if (body.category === "Аппеляция на наказание") {
      const upstream = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "balkan-rules-admin",
          chatId: body.chatId,
          title: body.title,
          nickname: body.nickname,
          faction: body.faction,
          contact: body.contact,
          category: body.category,
          message: body.message,
          priority: "high",
          forwardedAt,
        }),
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        req.log.error({ status: upstream.status, body: text }, "Zapier webhook returned non-ok status");
        res.status(502).json({
          error: "Upstream webhook failed",
          details: `Zapier responded with ${upstream.status}`,
        });
        return;
      }

      res.json({
        ok: true,
        chatId: body.chatId,
        forwardedAt,
        sentTo: "admin",
      });
      return;
    }

    // For other categories - save to DB
    const insertData = {
      chatId: body.chatId,
      title: body.title,
      nickname: body.nickname,
      faction: body.faction || null,
      contact: body.contact || null,
      category: body.category,
      message: body.message,
      source: "balkan-rules",
      status: "pending",
    };

    const result = await db.insert(appealsTable).values(insertData).returning();
    const appeal = result[0];

    res.json({
      ok: true,
      chatId: body.chatId,
      appealId: appeal.id,
      forwardedAt,
      sentTo: "review",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to process appeal");
    res.status(500).json({
      error: "Failed to process appeal",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// Get appeals for review (pending status)
router.get("/appeals", async (req, res) => {
  try {
    const status = req.query.status as string || "pending";
    const appeals = await db.select().from(appealsTable).where(eq(appealsTable.status, status));
    res.json(appeals);
  } catch (err) {
    req.log.error({ err }, "Failed to get appeals");
    res.status(500).json({
      error: "Failed to get appeals",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;

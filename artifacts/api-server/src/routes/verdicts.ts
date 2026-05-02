import { Router, type IRouter } from "express";
import { SubmitVerdictBody, SubmitVerdictResponse } from "@workspace/api-zod";
import { verdictsTable, appealsTable } from "@workspace/db";
import { db } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

// Submit a verdict on an appeal
router.post("/:appealId/verdicts", async (req, res) => {
  const appealId = Number(req.params.appealId);
  
  if (isNaN(appealId)) {
    res.status(400).json({ error: "Invalid appeal ID" });
    return;
  }

  const parsed = SubmitVerdictBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      details: parsed.error.message,
    });
    return;
  }

  const body = parsed.data;

  try {
    // Check if appeal exists
    const appeal = await db.select().from(appealsTable).where(eq(appealsTable.id, appealId)).limit(1);
    
    if (!appeal || appeal.length === 0) {
      res.status(404).json({ error: "Appeal not found" });
      return;
    }

    const appealData = appeal[0];

    // Check if this is "Аппеляция на наказание" - send directly to admin
    if (appealData.category === "Аппеляция на наказание") {
      // Send directly to Zapier for admin review
      // This bypasses the verdict system
      await sendToZapierForAdmin(appealData);
      res.json({ success: true, message: "Appeal sent to administration" });
      return;
    }

    // Insert verdict
    await db.insert(verdictsTable).values({
      appealId,
      userId: body.userId, // This should come from auth session
      verdict: body.verdict,
      reason: body.reason,
    });

    // Update verdicts count
    const verdictsCount = await db.select({ count: sql`count(*)` }).from(verdictsTable).where(eq(verdictsTable.appealId, appealId));
    const count = Number(verdictsCount[0].count);

    await db.update(appealsTable)
      .set({ verdictsCount: count, updatedAt: new Date() })
      .where(eq(appealsTable.id, appealId));

    // If 5 verdicts collected, send to Zapier for analysis
    if (count >= 5) {
      await sendToZapierForAnalysis(appealData, verdicts);
    }

    const data = SubmitVerdictResponse.parse({
      success: true,
      verdictsCount: count,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to submit verdict");
    res.status(500).json({
      error: "Failed to submit verdict",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// Get verdicts for an appeal
router.get("/:appealId/verdicts", async (req, res) => {
  const appealId = Number(req.params.appealId);
  
  if (isNaN(appealId)) {
    res.status(400).json({ error: "Invalid appeal ID" });
    return;
  }

  try {
    const verdicts = await db.select().from(verdictsTable).where(eq(verdictsTable.appealId, appealId));
    res.json(verdicts);
  } catch (err) {
    req.log.error({ err }, "Failed to get verdicts");
    res.status(500).json({
      error: "Failed to get verdicts",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// Helper function to send to Zapier for analysis
async function sendToZapierForAnalysis(appeal: any, verdicts: any[]) {
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!zapierUrl) {
    console.error("ZAPIER_WEBHOOK_URL not configured");
    return;
  }

  try {
    await fetch(zapierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balkan-rules-verdicts",
        appealId: appeal.id,
        title: appeal.title,
        nickname: appeal.nickname,
        faction: appeal.faction,
        category: appeal.category,
        message: appeal.message,
        verdicts: verdicts,
        verdictsCount: verdicts.length,
        forwardedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("Failed to send to Zapier:", err);
  }
}

// Helper function to send "Аппеляция на наказание" directly to admin
async function sendToZapierForAdmin(appeal: any) {
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!zapierUrl) {
    console.error("ZAPIER_WEBHOOK_URL not configured");
    return;
  }

  try {
    await fetch(zapierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balkan-rules-admin",
        appealId: appeal.id,
        title: appeal.title,
        nickname: appeal.nickname,
        faction: appeal.faction,
        contact: appeal.contact,
        category: appeal.category,
        message: appeal.message,
        priority: "high",
        forwardedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("Failed to send to Zapier:", err);
  }
}

export default router;

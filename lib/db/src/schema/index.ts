import { pgTable, text, serial, timestamp, integer, varchar, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Users table - Discord authenticated users
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: varchar("discord_id", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  discriminator: varchar("discriminator", { length: 10 }),
  avatar: text("avatar"),
  email: varchar("email", { length: 255 }),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// Appeals table - updated with user relation and status
export const appealsTable = pgTable("appeals", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  nickname: varchar("nickname", { length: 255 }).notNull(),
  faction: varchar("faction", { length: 255 }),
  contact: varchar("contact", { length: 255 }),
  category: varchar("category", { length: 255 }).notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 255 }).default("balkan-rules"),
  userId: integer("user_id").references(() => usersTable.id), // Discord user who submitted
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, under_review, verdicts_collected, sent_to_admin, resolved
  verdictsCount: integer("verdicts_count").default(0).notNull(),
  zapierSent: boolean("zapier_sent").default(false).notNull(),
  zapierSentAt: timestamp("zapier_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppealSchema = createInsertSchema(appealsTable).omit({ 
  id: true, createdAt: true, updatedAt: true, verdictsCount: true, zapierSent: true, zapierSentAt: true 
});
export type InsertAppeal = z.infer<typeof insertAppealSchema>;
export type Appeal = typeof appealsTable.$inferSelect;

// Verdicts table - players' verdicts on appeals
export const verdictsTable = pgTable("verdicts", {
  id: serial("id").primaryKey(),
  appealId: integer("appeal_id").references(() => appealsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  verdict: varchar("verdict", { length: 50 }).notNull(), // guilty, not_guilty, insufficient_evidence
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVerdictSchema = createInsertSchema(verdictsTable).omit({ id: true, createdAt: true });
export type InsertVerdict = z.infer<typeof insertVerdictSchema>;
export type Verdict = typeof verdictsTable.$inferSelect;

export {};

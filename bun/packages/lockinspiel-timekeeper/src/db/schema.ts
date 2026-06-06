import { relations } from "drizzle-orm";
import {
  integer,
  varchar,
  boolean,
  interval,
  uuid,
  timestamp,
  pgSchema,
} from "drizzle-orm/pg-core";

export const timekeeperSchema = pgSchema("timekeeper");

export const timeSplitTable = timekeeperSchema.table("time_split", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  user_id: uuid("user_id").default("generate_uuidv7()"),
  name: varchar("name").notNull(),
  description: varchar("description"),
  deleted: boolean("deleted").notNull().default(false),
});

export const timeSplitTimerTable = timekeeperSchema.table("time_split_timer", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  order_idx: integer("order_idx").notNull(),
  time_split_id: integer("time_split_id").notNull(),
  len: interval("len").notNull(),
  name: varchar("name").notNull(),
  work: boolean("work").notNull(),
  deleted: boolean("deleted").notNull().default(false),
});

export const timeSplitTimerRelations = relations(
  timeSplitTimerTable,
  ({ one }) => ({
    timers: one(timeSplitTable, {
      fields: [timeSplitTimerTable.time_split_id],
      references: [timeSplitTable.id],
    }),
  }),
);

export const timesheetTable = timekeeperSchema.table("timesheet", {
  start_time: timestamp("start_time", { withTimezone: true }).notNull(),
  end_time: timestamp("end_time", { withTimezone: true }).notNull(),
  user_id: uuid("user_id").notNull(),
  tags: integer("tags").array().notNull(),
  time_split_timer: integer("time_split_timer").notNull(),
});

export const timesheetRelations = relations(timesheetTable, ({ one }) => ({
  time_split_timer: one(timeSplitTimerTable, {
    fields: [timesheetTable.time_split_timer],
    references: [timeSplitTimerTable.id],
  }),
}));

export const tagTable = timekeeperSchema.table("tag", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name").notNull().unique(),
  user_id: uuid("user_id"),
  deleted: boolean("deleted").notNull().default(false),
});

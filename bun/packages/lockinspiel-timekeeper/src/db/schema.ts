import { relations } from "drizzle-orm";
import { integer, pgTable, varchar, boolean, interval, uuid, unique, primaryKey, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("auth.users", {
  user_id: uuid('user_id').primaryKey().default("generate_uuidv7()"),
  username: varchar('username').notNull().unique(),
  role: varchar('role').notNull().default('user'),
});

export const timeSplitTable = pgTable("timekeeper.time_split", {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name').notNull(),
  desc: varchar('desc'),
  deleted: boolean('deleted').notNull().default(false)
});

export const timeSplitTimerTable = pgTable("timekeeper.time_split_timer", {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  time_split_id: integer('time_split_id').notNull(),
  len: interval('len').notNull(),
  name: varchar('name').notNull(),
  work: boolean('work').notNull()
});

export const timeSplitTimerRelations = relations(timeSplitTimerTable, ({ one }) => ({
  timers: one(timeSplitTable, {
    fields: [timeSplitTimerTable.time_split_id],
    references: [timeSplitTable.id],
  }),
}));

export const timesheetGroupTable = pgTable("timekeeper.timesheet_group", {
  id: uuid('id').notNull().primaryKey().default("generate_uuidv7()"),
  time_split_id: integer('time_split_id').notNull(),
  user_id: uuid('user_id').notNull(),
});

export const timesheetGroupRelations = relations(timesheetGroupTable, ({ one }) => ({
  time_split: one(timeSplitTable, {
    fields: [timesheetGroupTable.time_split_id],
    references: [timeSplitTable.id]
  }),
  user: one(usersTable, {
    fields: [timesheetGroupTable.user_id],
    references: [usersTable.user_id]
  })
}));

export const timesheetTable = pgTable("timekeeper.timesheet", {
  timesheet_group: uuid('timesheet_group').notNull(),
  start_time: timestamp('start_time', { withTimezone: true }).notNull().primaryKey(),
  end_time: timestamp('end_time', { withTimezone: true }).notNull(),
  user_id: uuid('user_id').notNull(),
  work: boolean('work').notNull(),
}, (t) => [
  unique().on(t.start_time, t.end_time),
]);

export const timesheetRelations = relations(timesheetTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [timesheetTable.user_id],
    references: [usersTable.user_id]
  })
}));

export const tagTable = pgTable("timekeeper.tag", {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name').notNull().unique(),
  user_id: uuid('user_id'),
  deleted: boolean('deleted').notNull().default(false)
});

export const tagRelations = relations(tagTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [tagTable.user_id],
    references: [usersTable.user_id]
  })
}));

export const timesheetTagTable = pgTable("timekeeper.timesheet_tag", {
  timesheet_group: uuid('timesheet_group').notNull(),
  tag_id: integer('tag_id').notNull(),
  user_id: uuid('user_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.timesheet_group, t.tag_id] })
]);

export const timesheetTagRelations = relations(timesheetTagTable, ({ one }) => ({
  tag: one(tagTable, {
    fields: [timesheetTagTable.tag_id],
    references: [tagTable.id]
  }),
  user: one(usersTable, {
    fields: [timesheetTagTable.user_id],
    references: [usersTable.user_id]
  })
}));

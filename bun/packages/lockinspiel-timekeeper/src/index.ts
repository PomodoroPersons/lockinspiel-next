import { Elysia, Static, t } from "elysia";

import { jwtUse, openapiUse, otelTracer } from "lockinspiel-backend-common";
import { model } from "./model";

import "dotenv/config";
import { BunSQLQueryResultHKT, drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import {
  tagTable,
  timesheetTable,
  timeSplitTable,
  timeSplitTimerTable,
} from "./db/schema";
import { formatInterval, intervalToSeconds } from "./util";
import {
  and,
  asc,
  desc,
  eq,
  ExtractTablesWithRelations,
  gt,
  gte,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { TImport } from "@sinclair/typebox";

const ANON_USER = "00000000-0000-0000-0000-000000000000";

if (!Bun.env["DATABASE_URL"]) {
  console.error("DATABASE_URL is not defined");
  process.exit(1);
}

const DONT_USE_THIS_DIRECTLY_OR_I_WILL_PERSONALLY_NOTIFY_PROFESSOR_CANTERRA_OF_YOUR_WAR_CRIMES =
  drizzle(Bun.env["DATABASE_URL"]);
await migrate(
  DONT_USE_THIS_DIRECTLY_OR_I_WILL_PERSONALLY_NOTIFY_PROFESSOR_CANTERRA_OF_YOUR_WAR_CRIMES,
  {
    migrationsFolder: "./drizzle",
    migrationsSchema: "timekeeper",
  },
);

const app = new Elysia()
  .use(openapiUse)
  .use(otelTracer)
  .use(jwtUse)
  .model(model)
  .derive({ as: "scoped" }, async () => {
    return {
      db: async <T>(
        userId: string,
        callback: (
          tx: PgTransaction<
            BunSQLQueryResultHKT,
            Record<string, never>,
            ExtractTablesWithRelations<Record<string, never>>
          >,
        ) => Promise<T>,
      ) => {
        return await DONT_USE_THIS_DIRECTLY_OR_I_WILL_PERSONALLY_NOTIFY_PROFESSOR_CANTERRA_OF_YOUR_WAR_CRIMES.transaction(
          async (tx) => {
            await tx.execute(sql`SELECT auth.set_uid(${userId})`);
            return await callback(tx);
          },
        );
      },
    };
  })
  .get(
    "/",
    ({ status }) => {
      return status(200, { up: true });
    },
    {
      detail: {
        summary: "Liviness check",
        description: "Internal route that k8s uses to check for liveliness",
      },
      response: {
        200: t.Object({ up: t.Boolean() }),
      },
    },
  )
  .get(
    "/timekeeper/timer",
    async ({ db, jwt, status, headers: { authorization } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timerRows = await tx
          .select({
            start_time: timesheetTable.start_time,
            end_time: timesheetTable.end_time,
            time_split_timer: timesheetTable.time_split_timer,
            time_split: timeSplitTimerTable.time_split_id,
            work: timeSplitTimerTable.work,
            tags: timesheetTable.tags,
          })
          .from(timesheetTable)
          .leftJoin(
            timeSplitTimerTable,
            eq(timeSplitTimerTable.id, timesheetTable.time_split_timer),
          )
          .orderBy(desc(timesheetTable.start_time))
          // TODO: Add query parameters to allow multiple timers
          // to be returned
          .limit(1);

        const timers: Static<TImport<typeof model, "Timer">>[] = timerRows.map((row) => {
          return {
            start_time: row.start_time,
            end_time: row.end_time,
            time_split_timer: row.time_split_timer,
            time_split: row.time_split!,
            work: row.work!,
            tags: Array.isArray(row.tags) ? row.tags : [],
          };
        });
        return status(200, timers);
      });
    },
    {
      detail: {
        summary: "Retreive a timer",
        description:
          "Retreives the most recently started/ended timer if no parameters are specified. Otherwise returns the timers that match the parameters.",
        tags: ["Timer"],
        operationId: "getTimers",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Timer not found"),
        200: t.Array(t.Ref("Timer")),
      },
    },
  )
  .post(
    "/timekeeper/timer",
    async ({ db, jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitTimer = await tx
          .select({
            work: timeSplitTimerTable.work,
            time_split: timeSplitTimerTable.time_split_id,
          })
          .from(timeSplitTimerTable)
          .where(
            and(
              eq(timeSplitTimerTable.id, body.time_split_timer),
              eq(timeSplitTimerTable.deleted, false),
            ),
          );

        if (timeSplitTimer.length <= 0)
          return status(404, "Time split timer not found");

        const inserted = await tx
          .insert(timesheetTable)
          .values({
            start_time: body.start_time,
            end_time: body.end_time,
            user_id: profile.user_id,
            time_split_timer: body.time_split_timer,
            tags: body.tags,
          })
          .returning({
            start_time: timesheetTable.start_time,
            end_time: timesheetTable.end_time,
            time_split_timer: timesheetTable.time_split_timer,
            tags: timesheetTable.tags,
          });

        return status(201, {
          ...inserted[0],
          tags: Array.isArray(inserted[0].tags) ? inserted[0].tags : [],
          work: timeSplitTimer[0].work,
          time_split: timeSplitTimer[0].time_split,
        });
      });
    },
    {
      body: "InsertableTimer",
      detail: {
        summary: "Post a timer",
        description:
          "Upon starting a new timer, the Unix timestamp of when the timer was started, as well as the Unix timestamp in the future when the timer will end should be sent to this service. The ID of the time split, whether the timer is a work or a break timer, and the tag IDs associated with the timer should also be sent.",
        tags: ["Timer"],
        operationId: "postTimer",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        404: t.Literal("Time split timer not found"),
        401: t.Literal("Unauthorized"),
        201: t.Ref("Timer"),
      },
    },
  )
  .put(
    "/timekeeper/timer",
    async ({ db, jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitTimer = await tx
          .select({
            work: timeSplitTimerTable.work,
            time_split: timeSplitTimerTable.time_split_id,
          })
          .from(timeSplitTimerTable)
          .where(
            and(
              eq(timeSplitTimerTable.id, body.time_split_timer),
              eq(timeSplitTimerTable.deleted, false),
            ),
          );

        if (timeSplitTimer.length <= 0)
          return status(404, "Time split timer not found");

        const updated = await tx
          .update(timesheetTable)
          .set({
            start_time: body.start_time,
            end_time: body.end_time,
            time_split_timer: body.time_split_timer,
            tags: body.tags,
          })
          .where(eq(timesheetTable.start_time, body.start_time))
          .returning({
            start_time: timesheetTable.start_time,
            end_time: timesheetTable.end_time,
            time_split_timer: timesheetTable.time_split_timer,
            tags: timesheetTable.tags,
          });

        return status(200, {
          ...updated[0],
          tags: Array.isArray(updated[0].tags) ? updated[0].tags : [],
          work: timeSplitTimer[0].work,
          time_split: timeSplitTimer[0].time_split,
        });
      });
    },
    {
      body: "InsertableTimer",
      detail: {
        summary: "Modify a timer",
        description:
          "This route replaces the fields of the timer at the passed in start time with new fields. When a timer is paused, this route should be used to change the end_timestamp of the timer to the Unix timestamp at which the timer was paused. To resume a timer, a new timer should be posted with the Unix timestamp at which the timer was resumed, and the Unix timestamp in the future at which the remaining time will have elapsed.",
        tags: ["Timer"],
        operationId: "modifyTimer",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Time split timer not found"),
        200: t.Ref("Timer"),
      },
    },
  )
  .get(
    "/timekeeper/tag",
    async ({ db, jwt, status, headers: { authorization } }) => {
      const profile = (await jwt.verify(authorization?.split(" ")[1])) ?? "";

      return await db(profile ? profile.user_id : ANON_USER, async (tx) => {
        const tags = await tx
          .select()
          .from(tagTable)
          .where(eq(tagTable.deleted, false));

        return status(200, tags);
      });
    },
    {
      detail: {
        summary: "Get tags",
        description:
          "Gets all the tags associated with the user, as well as the default ones",
        tags: ["Tag"],
        operationId: "getTags",
        security: [
          {
            bearerAuth: [],
          },
          {},
        ],
      },
      response: {
        200: t.Array(t.Ref("TagWID")),
      },
    },
  )
  .post(
    "/timekeeper/tag",
    async ({ db, jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const inserted = await tx
          .insert(tagTable)
          .values({
            name: body.name,
            user_id: profile.user_id,
            deleted: false,
          })
          .returning({ id: tagTable.id });

        return status(201, { tag_id: inserted[0].id });
      });
    },
    {
      body: "Tag",
      detail: {
        summary: "Post a tag",
        description:
          "Adds a new tag to the database. The returned tag ID can be used in other endpoints in this service.",
        tags: ["Tag"],
        operationId: "addTag",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        201: t.Object({
          tag_id: t.Integer(),
        }),
      },
    },
  )
  .put(
    "/timekeeper/tag/:id",
    async ({
      db,
      jwt,
      status,
      headers: { authorization },
      params: { id },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const tagResults = await tx
          .select()
          .from(tagTable)
          .where(and(eq(tagTable.id, id), eq(tagTable.deleted, false)));

        if (tagResults.length <= 0) return status(404, "Tag not found");

        await tx
          .update(tagTable)
          .set({ name: body.name })
          .where(eq(tagTable.id, id));

        return status(200, "OK");
      });
    },
    {
      body: "Tag",
      params: t.Object({
        id: t.Integer(),
      }),
      detail: {
        summary: "Modify a tag",
        description: "Modifies the fields of the tag at the ID",
        tags: ["Tag"],
        operationId: "modifyTag",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Tag not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .delete(
    "/timekeeper/tag/:id",
    async ({ db, jwt, status, headers: { authorization }, params: { id } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const tagResults = await tx
          .select()
          .from(tagTable)
          .where(eq(tagTable.id, id));

        if (tagResults.length <= 0) return status(404, "Tag not found");

        await tx
          .update(tagTable)
          .set({ deleted: true })
          .where(eq(tagTable.id, id));

        return status(200, "OK");
      });
    },
    {
      params: t.Object({
        id: t.Integer(),
      }),
      detail: {
        summary: "Delete a tag",
        description:
          "Deletes the tag at the given ID. This just marks the tag as deleted, and doesn't actually delete the tag in the database. Timers posted with a deleted tag will still have that tag, the tag just won't appear when querying some endpoints.",
        tags: ["Tag"],
        operationId: "deleteTag",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Tag not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .post(
    "/timekeeper/time-split",
    async ({ db, jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const insertedId = await tx
          .insert(timeSplitTable)
          .values({
            name: body.name,
            description: body.description,
            user_id: profile.user_id,
          })
          .returning({ id: timeSplitTable.id });

        const promises = body.timers.map((t, order_idx) => {
          return tx.insert(timeSplitTimerTable).values({
            name: t.name,
            len: formatInterval(t.len),
            work: t.work,
            time_split_id: insertedId[0].id,
            order_idx,
          });
        });
        await Promise.all(promises);

        return status(201, { time_split_id: insertedId[0].id });
      });
    },
    {
      body: "TimeSplit",
      detail: {
        summary: "Post a time split",
        description:
          "Adds a new time split to the database. The returned time split ID can be used in other endpoints in this service. The timer lengths should be in seconds",
        tags: ["Time split"],
        operationId: "addTimeSplit",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        201: t.Object({
          time_split_id: t.Integer(),
        }),
      },
    },
  )
  .get(
    "/timekeeper/time-split",
    async ({ db, jwt, status, query: { id }, headers: { authorization } }) => {
      const profile = await jwt.verify(authorization?.split(" ")[1]);

      const user_id = profile ? profile.user_id : ANON_USER;

      return await db(user_id, async (tx) => {
        const timeSplitRows = await tx
          .select()
          .from(timeSplitTable)
          .leftJoin(
            timeSplitTimerTable,
            eq(timeSplitTable.id, timeSplitTimerTable.time_split_id),
          )
          .where(
            and(
              eq(timeSplitTable.deleted, false),
              eq(timeSplitTimerTable.deleted, false),
              or(
                eq(timeSplitTable.user_id, user_id),
                isNull(timeSplitTable.user_id),
              ),
              id ? eq(timeSplitTable.id, id) : undefined,
            ),
          )
          .orderBy(asc(timeSplitTable.id), asc(timeSplitTimerTable.order_idx));

        const timeSplitMap = new Map<number, Static<TImport<typeof model, "TimeSplitWID">>>();
        timeSplitRows.forEach((row) => {
          let timeSplitEntry = timeSplitMap.get(row.time_split.id);

          if (!timeSplitEntry) {
            const entry = { ...row.time_split, timers: [] };
            timeSplitMap.set(row.time_split.id, entry);
            timeSplitEntry = entry;
          }

          if (row.time_split_timer?.deleted)
            console.error("That wasn't meant to make it");

          if (row.time_split_timer) {
            timeSplitEntry.timers.push({
              id: row.time_split_timer.id,
              order_idx: row.time_split_timer.order_idx,
              name: row.time_split_timer.name,
              len: intervalToSeconds(row.time_split_timer.len),
              work: row.time_split_timer.work,
            });
          }
        });

        const timeSplits: Static<TImport<typeof model, "TimeSplitWID">>[] = [];
        timeSplitMap.forEach((split) => timeSplits.push(split));

        return status(200, timeSplits);
      });
    },
    {
      query: t.Partial(
        t.Object({
          id: t.Integer(),
        }),
      ),
      detail: {
        summary: "Get time splits",
        description:
          "Gets all the time splits associated with the user, as well as the default ones",
        tags: ["Time split"],
        operationId: "getTimeSplits",
        security: [
          {
            bearerAuth: [],
          },
          {},
        ],
      },
      response: {
        200: t.Array(t.Ref("TimeSplitWID")),
      },
    },
  )
  .put(
    "/timekeeper/time-split/:id",
    async ({
      db,
      jwt,
      status,
      headers: { authorization },
      params: { id },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitResults = await tx
          .select()
          .from(timeSplitTable)
          .where(
            and(eq(timeSplitTable.id, id), eq(timeSplitTable.deleted, false)),
          );

        if (timeSplitResults.length <= 0)
          return status(404, "Time split not found");

        await tx
          .update(timeSplitTable)
          .set({
            name: body.name,
            description: body.description,
          })
          .where(eq(timeSplitTable.id, id));

        return status(200, "OK");
      });
    },
    {
      body: "TimeSplitNoTimers",
      params: t.Object({
        id: t.Integer(),
      }),
      detail: {
        summary: "Modify a time split",
        description: "Modifies the fields of the time split at the ID.",
        tags: ["Time split"],
        operationId: "modifyTimeSplit",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Time split not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .post(
    "/timekeeper/time-split/:id",
    async ({
      db,
      jwt,
      status,
      headers: { authorization },
      params: { id },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitResults = await tx
          .select()
          .from(timeSplitTable)
          .where(
            and(eq(timeSplitTable.id, id), eq(timeSplitTable.deleted, false)),
          );

        if (timeSplitResults.length <= 0)
          return status(404, "Time split not found");

        await tx
          .update(timeSplitTimerTable)
          .set({ order_idx: sql`${timeSplitTimerTable.order_idx} + 1` })
          .where(
            and(
              eq(timeSplitTimerTable.time_split_id, id),
              gte(timeSplitTimerTable.order_idx, body.order_idx),
            ),
          );

        const timeSplitTimer = await tx
          .insert(timeSplitTimerTable)
          .values({
            order_idx: body.order_idx,
            time_split_id: id,
            len: formatInterval(body.len),
            name: body.name,
            work: body.work,
          })
          .returning({ id: timeSplitTimerTable.id });

        return status(200, { ...body, id: timeSplitTimer[0].id });
      });
    },
    {
      body: "TimeSplitTimerWOrder",
      params: t.Object({
        id: t.Integer(),
      }),
      detail: {
        summary: "Post a time split timer",
        description: "Adds a time split timer to the time split at the ID.",
        tags: ["Time split"],
        operationId: "postTimeSplitTimer",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Time split not found"),
        200: t.Ref("TimeSplitTimerWID"),
      },
    },
  )
  .put(
    "/timekeeper/time-split/:id/:time_split",
    async ({
      db,
      jwt,
      status,
      headers: { authorization },
      params: { time_split },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitResults = await tx
          .select()
          .from(timeSplitTimerTable)
          .where(
            and(
              eq(timeSplitTimerTable.id, time_split),
              eq(timeSplitTimerTable.deleted, false),
            ),
          );

        if (timeSplitResults.length <= 0)
          return status(404, "Time split timer not found");

        await tx
          .update(timeSplitTimerTable)
          .set({ order_idx: sql`${timeSplitTimerTable.order_idx} - 1` })
          .where(
            and(
              eq(
                timeSplitTimerTable.time_split_id,
                timeSplitResults[0].time_split_id,
              ),
              gt(timeSplitTimerTable.order_idx, timeSplitResults[0].order_idx),
            ),
          );

        await tx
          .update(timeSplitTimerTable)
          .set({ order_idx: sql`${timeSplitTimerTable.order_idx} + 1` })
          .where(
            and(
              eq(
                timeSplitTimerTable.time_split_id,
                timeSplitResults[0].time_split_id,
              ),
              gte(timeSplitTimerTable.order_idx, body.order_idx),
            ),
          );

        await tx
          .update(timeSplitTimerTable)
          .set({
            len: formatInterval(body.len),
            name: body.name,
            order_idx: body.order_idx,
            work: body.work,
          })
          .where(eq(timeSplitTimerTable.id, time_split));

        return status(200, "OK");
      });
    },
    {
      body: "TimeSplitTimerWOrder",
      params: t.Object({
        id: t.Integer(),
        time_split: t.Integer(),
      }),
      detail: {
        summary: "Modify a time split timer",
        description: "Modifies the fields of the time split timer at the ID.",
        tags: ["Time split"],
        operationId: "modifyTimeSplitTimer",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Time split timer not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .delete(
    "/timekeeper/time-split/:id",
    async ({ db, jwt, status, headers: { authorization }, params: { id } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitResults = await tx
          .select()
          .from(timeSplitTable)
          .where(eq(timeSplitTable.id, id));

        if (timeSplitResults.length <= 0)
          return status(404, "Time split not found");

        await Promise.all([
          tx
            .update(timeSplitTable)
            .set({ deleted: true })
            .where(eq(timeSplitTable.id, id)),
          tx
            .update(timeSplitTimerTable)
            .set({ deleted: true })
            .where(eq(timeSplitTimerTable.time_split_id, id)),
        ]);

        return status(200, "OK");
      });
    },
    {
      params: t.Object({
        id: t.Integer(),
      }),
      detail: {
        summary: "Delete a time split",
        description:
          "Deletes the time split at the given ID. This just marks the time split as deleted, and doesn't actually delete the time split in the database. Timers posted with a deleted time split will still have that time split, the time split just won't appear when querying some endpoints.",
        tags: ["Time split"],
        operationId: "deleteTimeSplit",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Time split not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .delete(
    "/timekeeper/time-split/:id/:time_split",
    async ({
      db,
      jwt,
      status,
      headers: { authorization },
      params: { time_split },
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      return await db(profile.user_id, async (tx) => {
        const timeSplitResults = await tx
          .select()
          .from(timeSplitTimerTable)
          .where(eq(timeSplitTimerTable.id, time_split));

        if (timeSplitResults.length <= 0)
          return status(404, "Time split timer not found");

        await Promise.all([
          tx
            .update(timeSplitTimerTable)
            .set({ deleted: true })
            .where(eq(timeSplitTimerTable.id, time_split)),
          tx
            .update(timeSplitTimerTable)
            .set({ order_idx: sql`${timeSplitTimerTable.order_idx} - 1` })
            .where(
              and(
                eq(
                  timeSplitTimerTable.time_split_id,
                  timeSplitResults[0].time_split_id,
                ),
                gt(
                  timeSplitTimerTable.order_idx,
                  timeSplitResults[0].order_idx,
                ),
              ),
            ),
        ]);

        return status(200, "OK");
      });
    },
    {
      params: t.Object({
        id: t.Integer(),
        time_split: t.Integer(),
      }),
      detail: {
        summary: "Delete a time split timer",
        description:
          "Deletes the time split timer at the given ID. This just marks the time split timer as deleted, and doesn't actually delete the time split timer in the database. Timers posted with a deleted time split timer will still have that time split timer, the time split timer just won't appear when querying some endpoints.",
        tags: ["Time split"],
        operationId: "deleteTimeSplit",
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        404: t.Literal("Time split timer not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .listen(Bun.env.LISTEN_PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;

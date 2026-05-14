import { Elysia, Static, t } from "elysia";

import { jwtUse, openapiUse, otelTracer } from "lockinspiel-backend-common";
import { TimeSplitWID, model, TimerWID } from "./model";

import "dotenv/config";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import {
  tagTable,
  timesheetTable,
  timeSplitTable,
  timeSplitTimerTable,
} from "./db/schema";
import { formatInterval, formatLen, intervalToSeconds } from "./util";
import { and, eq } from "drizzle-orm";

if (!Bun.env["DATABASE_URL"]) {
  console.error("DATABASE_URL is not defined");
  process.exit(1);
}

const db = drizzle(Bun.env["DATABASE_URL"]);
await migrate(db, {
  migrationsFolder: "./drizzle",
  migrationsSchema: "timekeeper",
});

const app = new Elysia()
  .use(openapiUse)
  .use(otelTracer)
  .use(jwtUse)
  .model(model)
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
    async ({ jwt, status, headers: { authorization } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const timerRows = await db
        .select({
          id: timeSplitTimerTable.id,
          name: timeSplitTimerTable.name,
          time_split: timeSplitTimerTable.time_split_id,
          start_timestamp: timesheetTable.start_time,
          end_timestamp: timesheetTable.end_time,
          tags: timesheetTable.tags,
          work: timeSplitTimerTable.work,
          deleted: timeSplitTimerTable.deleted,
        })
        .from(timesheetTable)
        .leftJoin(
          timeSplitTimerTable,
          eq(timeSplitTimerTable.id, timesheetTable.time_split_timer),
        );

      const timers: Static<typeof TimerWID>[] = timerRows.map((row) => {
        return {
          id: row.id!,
          name: row.name!,
          work: row.work!,
          time_split: row.time_split!,
          start_timestamp: row.start_timestamp!.valueOf(),
          end_timestamp: row.end_timestamp!.valueOf(),
          tags: row.tags as number[],
          deleted: row.deleted!,
        };
      });
      return status(200, timers);
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
        200: t.Array(t.Ref("TimerWID")),
      },
    },
  )
  .post(
    "/timekeeper/timer",
    async ({ jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const timeSplit = await db
        .select()
        .from(timeSplitTable)
        .where(eq(timeSplitTable.id, body.time_split));

      if (timeSplit.length <= 0) return status(404, "Time split not found");

      const inserted = await db
        .insert(timeSplitTimerTable)
        .values({
          name: body.name,
          len: formatLen(body.start_timestamp, body.end_timestamp),
          time_split_id: body.time_split,
          work: body.work,
        })
        .returning({ id: timeSplitTable.id });

      await db.insert(timesheetTable).values({
        start_time: new Date(body.start_timestamp),
        end_time: new Date(body.end_timestamp),
        user_id: profile.user_id,
        time_split_timer: inserted[0].id,
        work: body.work,
        tags: body.tags,
      });

      return status(201, { timer_id: inserted[0].id });
    },
    {
      body: "Timer",
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
        404: t.Literal("Time split not found"),
        401: t.Literal("Unauthorized"),
        201: t.Object({
          timer_id: t.Integer(),
        }),
      },
    },
  )
  .put(
    "/timekeeper/timer/:id",
    async ({
      jwt,
      status,
      headers: { authorization },
      params: { id },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const timerResults = await db
        .select()
        .from(timeSplitTimerTable)
        .where(eq(timeSplitTimerTable.id, id));

      if (timerResults.length <= 0) return status(404, "Timer not found");

      await db
        .update(timeSplitTimerTable)
        .set({
          len: formatLen(body.start_timestamp, body.end_timestamp),
          name: body.name,
          time_split_id: body.time_split,
          work: body.work,
        })
        .where(eq(timeSplitTimerTable.id, id));

      await db
        .update(timesheetTable)
        .set({ tags: body.tags })
        .where(
          and(
            eq(timesheetTable.time_split_timer, id),
            eq(timesheetTable.start_time, new Date(body.start_timestamp)),
          ),
        );

      return status(200, "OK");
    },
    {
      body: "Timer",
      params: t.Object({
        id: t.Integer(),
      }),
      detail: {
        summary: "Modify a timer",
        description:
          "This route replaces the fields of the timer at the current ID with new fields. When a timer is paused, this route should be used to change the end_timestamp of the timer to the Unix timestamp at which the timer was paused. To resume a timer, a new timer should be posted with the Unix timestamp at which the timer was resumed, and the Unix timestamp in the future at which the remaining time will have elapsed.",
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
        404: t.Literal("Timer not found"),
        200: t.Literal("OK"),
      },
    },
  )
  .get(
    "/timekeeper/tag",
    async ({ jwt, status, headers: { authorization } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const tags = await db.select().from(tagTable);

      return status(200, tags);
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
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        200: t.Array(t.Ref("TagWID")),
      },
    },
  )
  .post(
    "/timekeeper/tag",
    async ({ jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const inserted = await db
        .insert(tagTable)
        .values({
          name: body.name,
          user_id: profile.user_id,
          deleted: false,
        })
        .returning({ id: tagTable.id });

      return status(201, { tag_id: inserted[0].id });
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
      jwt,
      status,
      headers: { authorization },
      params: { id },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const tagResults = await db
        .select()
        .from(tagTable)
        .where(eq(tagTable.id, id));

      if (tagResults.length <= 0) return status(404, "Tag not found");

      await db
        .update(tagTable)
        .set({ name: body.name })
        .where(eq(tagTable.id, id));

      return status(200, "OK");
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
    async ({ jwt, status, headers: { authorization }, params: { id } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const tagResults = await db
        .select()
        .from(tagTable)
        .where(eq(tagTable.id, id));

      if (tagResults.length <= 0) return status(404, "Tag not found");

      await db
        .update(tagTable)
        .set({ deleted: true })
        .where(eq(tagTable.id, id));

      return status(200, "OK");
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
    async ({ jwt, status, headers: { authorization }, body }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const insertedId = await db
        .insert(timeSplitTable)
        .values({
          name: body.name,
          description: body.description,
          user_id: profile.user_id,
        })
        .returning({ id: timeSplitTable.id });

      const promises = body.timers.map((t) => {
        return db.insert(timeSplitTimerTable).values({
          name: t.name,
          len: formatInterval(t.len),
          work: t.work,
          time_split_id: insertedId[0].id,
        });
      });
      await Promise.all(promises);

      return status(201, { time_split_id: insertedId[0].id });
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
    async ({ jwt, status, headers: { authorization } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const timeSplitRows = await db
        .select()
        .from(timeSplitTable)
        .leftJoin(
          timeSplitTimerTable,
          eq(timeSplitTable.id, timeSplitTimerTable.time_split_id),
        )
        .where(eq(timeSplitTable.user_id, profile.user_id));

      const timeSplitMap = new Map<number, Static<typeof TimeSplitWID>>();
      timeSplitRows.forEach((row) => {
        let timeSplitEntry = timeSplitMap.get(row.time_split.id);

        if (!timeSplitEntry) {
          const entry = { ...row.time_split, timers: [] };
          timeSplitMap.set(row.time_split.id, entry);
          timeSplitEntry = entry;
        }

        if (row.time_split_timer) {
          timeSplitEntry.timers.push({
            name: row.time_split_timer.name,
            len: intervalToSeconds(row.time_split_timer.len),
            work: row.time_split_timer.work,
          });
        }
      });

      const timeSplits: Static<typeof TimeSplitWID>[] = [];
      timeSplitMap.forEach((split) => timeSplits.push(split));

      return status(200, timeSplits);
    },
    {
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
        ],
      },
      response: {
        401: t.Literal("Unauthorized"),
        200: t.Array(t.Ref("TimeSplitWID")),
      },
    },
  )
  .put(
    "/timekeeper/time-split/:id",
    async ({
      jwt,
      status,
      headers: { authorization },
      params: { id },
      body,
    }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const timeSplitResults = await db
        .select()
        .from(timeSplitTable)
        .where(eq(timeSplitTable.id, id));

      if (timeSplitResults.length <= 0)
        return status(404, "Time split not found");

      await db
        .update(timeSplitTable)
        .set({
          name: body.name,
          description: body.description,
          deleted: body.deleted,
        })
        .where(eq(timeSplitTable.id, id));

      if (body.timers.length > 0) {
        // const timerIds = await db
        //   .select({ id: timeSplitTimerTable.id })
        //   .from(timeSplitTimerTable)
        //   .where(eq(timeSplitTimerTable.time_split_id, id));

        // await Promise.all(
        //   timerIds.map((timer) =>
        //     db
        //       .delete(timesheetTable)
        //       .where(eq(timesheetTable.time_split_timer, timer.id)),
        //   ),
        // );

        // await db
        //   .delete(timeSplitTimerTable)
        //   .where(eq(timeSplitTimerTable.time_split_id, id));

        await db
          .update(timeSplitTimerTable)
          .set({ deleted: true })
          .where(eq(timeSplitTimerTable.time_split_id, id));

        await Promise.all(
          body.timers.map((t) =>
            db.insert(timeSplitTimerTable).values({
              name: t.name,
              len: formatInterval(t.len),
              time_split_id: id,
              work: t.work,
            }),
          ),
        );
      }

      return status(200, "OK");
    },
    {
      body: "TimeSplit",
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
  .delete(
    "/timekeeper/time-split/:id",
    async ({ jwt, status, headers: { authorization }, params: { id } }) => {
      if (!authorization) return status(401, "Unauthorized");

      const profile = await jwt.verify(authorization.split(" ")[1]);

      if (!profile) return status(401, "Unauthorized");

      const timeSplitResults = await db
        .select()
        .from(timeSplitTable)
        .where(eq(timeSplitTable.id, id));

      if (timeSplitResults.length <= 0)
        return status(404, "Time split not found");

      await db
        .update(timeSplitTable)
        .set({ deleted: true })
        .where(eq(timeSplitTable.id, id));

      return status(200, "OK");
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
  .listen(Bun.env.LISTEN_PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

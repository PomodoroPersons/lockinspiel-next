import { Elysia, Static, t } from "elysia";

import { jwtUse, openapiUse, otelTracer } from "lockinspiel-backend-common";
import { Timer, TimeSplitWID, model } from "./model";

import "dotenv/config";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { timeSplitTimerTable } from "./db/schema";
import { formatLen } from "./util";

if (!Bun.env["DATABASE_URL"]) {
  console.error("DATABASE_URL is not defined");
  process.exit(1);
}

const db = drizzle(Bun.env["DATABASE_URL"]);
await migrate(db, {
  migrationsFolder: "./drizzle",
  migrationsSchema: "timekeeper",
});

// TODO: This value should come from the database
let TIMER_ID = 0;
// TODO: This value should come from the database
let MOST_RECENT_TIMER: Static<typeof Timer>;
// TODO: This value should come from the database
let TAG_ID = 0;
// TODO: This value should come from the database
let TIME_SPLITS: Static<typeof TimeSplitWID>[] = [];

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

      return status(200, [{ id: TIMER_ID, ...MOST_RECENT_TIMER }]);
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

      db.insert(timeSplitTimerTable).values({
        name: "test", // TODO: There is no name field in the Timer type
        len: formatLen(body.start_timestamp, body.end_timestamp),
        time_split_id: body.time_split,
        work: body.work,
      });

      MOST_RECENT_TIMER = body;
      return status(200, { timer_id: ++TIMER_ID });
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
        401: t.Literal("Unauthorized"),
        200: t.Object({
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

      if (id > TIMER_ID) return status(404, "Timer not found");

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

      return status(200, []);
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

      return status(200, { tag_id: ++TAG_ID });
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
        200: t.Object({
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

      if (id > TAG_ID) return status(404, "Tag not found");

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

      if (id > TAG_ID) return status(404, "Tag not found");

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

      const time_split_id = TIME_SPLITS.length;
      TIME_SPLITS.push({ id: time_split_id, ...body });
      return status(200, { time_split_id });
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
        200: t.Object({
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

      return status(200, TIME_SPLITS);
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

      if (id >= TIME_SPLITS.length) return status(404, "Time split not found");

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

      if (id >= TIME_SPLITS.length) return status(404, "Time split not found");

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

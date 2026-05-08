import { Elysia, t } from "elysia";

import { jwtUse, openapiUse, otelTracer } from "lockinspiel-backend-common";

const Timer = t.Object({
  time_split: t.Integer(),
  start_timestamp: t.Integer(),
  end_timestamp: t.Integer(),
  work: t.Boolean(),
  tags: t.Array(t.Integer())
});

const Tag = t.Object({
  name: t.String()
});

// TODO: This value should come from the database
let TIMER_ID = 0;
// TODO: This value should come from the database
let TAG_ID = 0;

const app = new Elysia()
  .use(openapiUse)
  .use(otelTracer)
  .use(jwtUse)
  .get("/", ({ status }) => { return status(200, { up: true }) }, {
    detail: {
      summary: "Liviness check",
      description: "Internal route that k8s uses to check for liveliness"
    },
    response: {
      200: t.Object({ up: t.Boolean() })
    }
  })
  .post("/timekeeper/timer", async ({ jwt, status, headers: { authorization }, body }) => {
    const profile = await jwt.verify(authorization.split(' ')[1]);

    if (!profile)
      return status(401, 'Unauthorized');

    return status(200, { timer_id: ++TIMER_ID });
  }, {
    body: Timer,
    headers: t.Object({
      authorization: t.TemplateLiteral("Bearer ${string}"),
    }),
    detail: {
      summary: "Post a timer",
      description: "Upon starting a new timer, the Unix timestamp of when the timer was started, as well as the Unix timestamp in the future when the timer will end should be sent to this service. The ID of the time split, whether the timer is a work or a break timer, and the tag IDs associated with the timer should also be sent.",
      tags: ["Timers"],
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    response: {
      401: t.Literal("Unauthorized"),
      200: t.Object({
        timer_id: t.Integer()
      }),
    }
  })
  .put("/timekeeper/timer/:id", async ({ jwt, status, headers: { authorization }, params: { id }, body }) => {
    const profile = await jwt.verify(authorization.split(' ')[1]);

    if (!profile)
      return status(401, 'Unauthorized');

    if (id > TIMER_ID)
      return status(404, 'Timer not found');

    return status(200, 'OK');
  }, {
    body: Timer,
    headers: t.Object({
      authorization: t.TemplateLiteral("Bearer ${string}"),
    }),
    params: t.Object({
      id: t.Integer(),
    }),
    detail: {
      summary: "Modify a timer",
      description: "This route replaces the fields of the timer at the current ID with new fields. When a timer is paused, this route should be used to change the end_timestamp of the timer to the Unix timestamp at which the timer was paused. To resume a timer, a new timer should be posted with the Unix timestamp at which the timer was resumed, and the Unix timestamp in the future at which the remaining time will have elapsed.",
      tags: ["Timers"],
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    response: {
      401: t.Literal("Unauthorized"),
      404: t.Literal("Timer not found"),
      200: t.Literal("OK")
    }
  })
  .post("/timekeeper/tag", async ({ jwt, status, headers: { authorization }, body }) => {
    const profile = await jwt.verify(authorization.split(' ')[1]);

    if (!profile)
      return status(401, 'Unauthorized');

    return status(200, { tag_id: ++TAG_ID });
  }, {
    body: Tag,
    headers: t.Object({
      authorization: t.TemplateLiteral("Bearer ${string}"),
    }),
    detail: {
      summary: "Post a tag",
      description: "Adds a new tag to the database. The returned tag ID can be used in other endpoints in this service.",
      tags: ["Tags"],
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    response: {
      401: t.Literal("Unauthorized"),
      200: t.Object({
        tag_id: t.Integer()
      }),
    }
  })
  .put("/timekeeper/tag/:id", async ({ jwt, status, headers: { authorization }, params: { id }, body }) => {
    const profile = await jwt.verify(authorization.split(' ')[1]);

    if (!profile)
      return status(401, 'Unauthorized');

    if (id > TAG_ID)
      return status(404, 'Tag not found');

    return status(200, 'OK');
  }, {
    body: Tag,
    headers: t.Object({
      authorization: t.TemplateLiteral("Bearer ${string}"),
    }),
    params: t.Object({
      id: t.Integer(),
    }),
    detail: {
      summary: "Modify a tag",
      description: "Modifies the fields of the tag at the ID",
      tags: ["Tags"],
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    response: {
      401: t.Literal("Unauthorized"),
      404: t.Literal("Tag not found"),
      200: t.Literal("OK")
    }
  })
  .delete("/timekeeper/tag/:id", async ({ jwt, status, headers: { authorization }, params: { id }, body }) => {
    const profile = await jwt.verify(authorization.split(' ')[1]);

    if (!profile)
      return status(401, 'Unauthorized');

    if (id > TAG_ID)
      return status(404, 'Tag not found');

    return status(200, 'OK');
  }, {
    body: Tag,
    headers: t.Object({
      authorization: t.TemplateLiteral("Bearer ${string}"),
    }),
    params: t.Object({
      id: t.Integer(),
    }),
    detail: {
      summary: "Delete a tag",
      description: "Deletes the tag at the given ID. This just marks the tag as deleted, and doesn't actually delete the tag in the database. Timers posted with a deleted tag will still have that tag, it just won't appear when querying some endpoints.",
      tags: ["Tags"],
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    response: {
      401: t.Literal("Unauthorized"),
      404: t.Literal("Tag not found"),
      200: t.Literal("OK")
    }
  })
  .listen(Bun.env.LISTEN_PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

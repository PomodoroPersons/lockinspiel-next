import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysia/eden";
import type { App } from ".";

const baseUrl = Bun.env["LOCKINSPIEL_BASE_URL"] ?? "http://localhost:8000";
const app = treaty<App>(baseUrl);

describe("timekeeper", () => {
  let contentType = {
    "Content-Type": "application/json",
  };
  let authorization = {
    Authorization: "",
  };

  beforeAll(async () => {
    const result = await fetch(`${baseUrl}/auth/user`, {
      method: "POST",
      headers: { ...contentType },
      body: JSON.stringify({
        password: "password",
        username: "johndoe",
      }),
    });
    authorization.Authorization = `Bearer ${(await result.json())["access_token"]}`;
  });

  afterAll(async () => {
    await fetch(`${baseUrl}/auth/user`, {
      method: "DELETE",
      headers: { ...authorization },
    });

    authorization.Authorization = "";
  });

  describe("time split", () => {
    let createdTimeSplit: number = -1;
    let createdTimeSplitTimer: number = -1;
    let defaultTimesplitLen: number = 0;

    test("get time splits", async () => {
      const { data, status, error } = await app.timekeeper["time-split"].get({
        headers: { ...authorization },
      });

      expect(error).toBeNull();
      expect(status).toBe(200);

      expect(data).toBeArray();
      expect(data).not.toHaveLength(0);

      defaultTimesplitLen = data?.length ?? 0;
    });

    test("create time split", async () => {
      const { data, status, error } = await app.timekeeper["time-split"].post(
        {
          name: "my timer",
          description: "You have encoutered my pomodoro",
          timers: [
            {
              len: 1200,
              name: "We work",
              work: true,
            },
            {
              len: 300,
              name: "We so break",
              work: false,
            },
          ],
        },
        {
          headers: { ...authorization },
        },
      );

      expect(error).toBeNull();
      expect(status).toBe(201);

      expect(data?.time_split_id).toBeDefined();
      createdTimeSplit = data!.time_split_id;
    });

    test("update time splits", async () => {
      const { status: putStatus, error: putError } = await app.timekeeper[
        "time-split"
      ]({ id: createdTimeSplit }).put(
        {
          name: "better name",
          description: "better description",
        },
        {
          headers: { ...authorization },
        },
      );

      expect(putError).toBeNull();
      expect(putStatus).toBe(200);

      const {
        data: timeSplits,
        status: getStatus,
        error: getError,
      } = await app.timekeeper["time-split"].get({
        headers: { ...authorization },
        query: { id: createdTimeSplit },
      });

      expect(getError).toBeNull();
      expect(getStatus).toBe(200);

      expect(timeSplits).toBeArrayOfSize(1);
      expect(timeSplits![0].name).toBe("better name");
      expect(timeSplits![0].description).toBe("better description");
    });

    test("create time split timers", async () => {
      const { data, status, error } = await app.timekeeper["time-split"]({
        id: createdTimeSplit,
      }).post(
        {
          name: "such name",
          len: 3600,
          order_idx: 1,
          work: true,
        },
        {
          headers: { ...authorization },
        },
      );

      expect(error).toBeNull();
      expect(status).toBe(200);

      expect(data?.id).toBeDefined();
      createdTimeSplitTimer = data!.id;

      const {
        data: getData,
        status: getStatus,
        error: getError,
      } = await app.timekeeper["time-split"].get({
        headers: { ...authorization },
        query: { id: createdTimeSplit },
      });

      expect(getError).toBeNull();
      expect(getStatus).toBe(200);
      expect(getData).toBeArrayOfSize(1);
      expect(getData![0].timers).toBeArray();

      getData![0].timers.forEach((timer, idx) =>
        expect(timer.order_idx).toBe(idx),
      );
    });

    test("update time split timers", async () => {
      const { status: putStatus, error: putError } = await app.timekeeper[
        "time-split"
      ]({ id: createdTimeSplit })({ time_split: createdTimeSplitTimer }).put(
        {
          name: "better name",
          len: 1200,
          order_idx: 0,
          work: true,
        },
        {
          headers: { ...authorization },
        },
      );

      expect(putError).toBeNull();
      expect(putStatus).toBe(200);

      const {
        data: timeSplitTimers,
        status: getStatus,
        error: getError,
      } = await app.timekeeper["time-split"].get({
        headers: { ...authorization },
        query: { id: createdTimeSplit },
      });

      expect(getError).toBeNull();
      expect(getStatus).toBe(200);

      expect(timeSplitTimers).toBeArrayOfSize(1);
      expect(timeSplitTimers![0].timers[0].name).toBe("better name");
      expect(timeSplitTimers![0].timers[0].len).toBe(1200);
      expect(timeSplitTimers![0].timers[0].order_idx).toBe(0);
      expect(timeSplitTimers![0].timers[0].work).toBe(true);
      timeSplitTimers![0].timers.forEach((timer, idx) =>
        expect(timer.order_idx).toBe(idx),
      );
    });

    test("delete time split timer", async () => {
      const { status: deleteStatus, error: deleteError } = await app.timekeeper[
        "time-split"
      ]({ id: createdTimeSplit })({ time_split: createdTimeSplitTimer }).delete(undefined, {
        headers: { ...authorization },
      });

      expect(deleteError).toBeNull();
      expect(deleteStatus).toBe(200);

      const {
        data: getData,
        status: getStatus,
        error: getError,
      } = await app.timekeeper["time-split"].get({
        headers: { ...authorization },
        query: { id: createdTimeSplit },
      });

      expect(getError).toBeNull();
      expect(getStatus).toBe(200);
      expect(getData).toBeArrayOfSize(1);

      expect(getData![0].timers).toBeArrayOfSize(2);
      getData![0].timers.forEach((timer, idx) =>
        expect(timer.order_idx).toBe(idx),
      );
    });

    test("delete time split", async () => {
      const { status: deleteStatus, error: deleteError } = await app.timekeeper[
        "time-split"
      ]({ id: createdTimeSplit }).delete(undefined, {
        headers: { ...authorization },
      });

      expect(deleteError).toBeNull();
      expect(deleteStatus).toBe(200);

      const {
        data: getData,
        status: getStatus,
        error: getError,
      } = await app.timekeeper["time-split"].get({
        headers: { ...authorization },
      });

      expect(getError).toBeNull();
      expect(getStatus).toBe(200);

      expect(getData).toBeArrayOfSize(defaultTimesplitLen);
    });
  });
});

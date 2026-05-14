import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const baseUrl = Bun.env["LOCKINSPIEL_BASE_URL"];

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
        username: "timekeepertest",
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

  test("liviness check", async () => {
    expect(baseUrl).toBeDefined();
    const result = await fetch(baseUrl!);
    expect(result.status).toBe(200);
  });

  describe("time split", () => {
    let createdTimeSplit: number = -1;

    test("create time split", async () => {
      const result = await fetch(`${baseUrl}/timekeeper/time-split`, {
        method: "POST",
        headers: { ...contentType, ...authorization },
        body: JSON.stringify({
          name: "my timer",
          description: "You have encoutered my pomodoro",
          deleted: false,
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
        }),
      });

      expect(result.status).toBe(201);

      createdTimeSplit = (await result.json())["time_split_id"];
      expect(createdTimeSplit).toBeGreaterThan(-1);
    });

    test("get time splits", async () => {
      const result = await fetch(`${baseUrl}/timekeeper/time-split`, {
        method: "GET",
        headers: { ...authorization },
      });
      expect(result.status).toBe(200);

      const timeSplits = await result.json();
      expect(timeSplits).toBeArrayOfSize(1);
    });

    test("update time splits", async () => {
      const updateResult = await fetch(
        `${baseUrl}/timekeeper/time-split/${createdTimeSplit}`,
        {
          method: "PUT",
          headers: { ...contentType, ...authorization },
          body: JSON.stringify({
            name: "better name",
            description: "better description",
            deleted: false,
            timers: [
              {
                len: 300,
                name: "so break we broken",
                work: false,
              },
            ],
          }),
        },
      );
      expect(updateResult.status).toBe(200);

      const getResult = await fetch(`${baseUrl}/timekeeper/time-split`, {
        method: "GET",
        headers: { ...authorization },
      });
      expect(getResult.status).toBe(200);

      const timeSplits = await getResult.json();
      expect(timeSplits).toBeArrayOfSize(1);
      expect(timeSplits[0].name).toBe("better name");
      expect(timeSplits[0].description).toBe("better description");
      expect(timeSplits[0].deleted).toBeFalse();
      expect(timeSplits[0].timers).toBeArrayOfSize(3);
      expect(timeSplits[0].timers[2].len).toBe(300);
      expect(timeSplits[0].timers[2].name).toBe("so break we broken");
      expect(timeSplits[0].timers[2].work).toBeFalse();
    });

    test("delete time split", async () => {
      const deleteResult = await fetch(
        `${baseUrl}/timekeeper/time-split/${createdTimeSplit}`,
        {
          method: "DELETE",
          headers: { ...authorization },
        },
      );
      expect(deleteResult.status).toBe(200);

      const getResult = await fetch(`${baseUrl}/timekeeper/time-split`, {
        method: "GET",
        headers: { ...authorization },
      });
      expect(getResult.status).toBe(200);

      const timers = await getResult.json();
      expect(timers).toBeArrayOfSize(1);
      expect(timers[0].deleted).toBeTrue();
    });
  });
});

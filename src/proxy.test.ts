import { NextRequest } from "next/server";

import { proxy } from "./proxy";

describe("keepAlive proxy", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;

    const response = proxy(
      new NextRequest("https://uniplans.example/api/keepAlive", {
        headers: { authorization: "Bearer undefined" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ status: "unauthorized" });
  });

  it("rejects an incorrect bearer token", () => {
    process.env.CRON_SECRET = "expected-secret";

    const response = proxy(
      new NextRequest("https://uniplans.example/api/keepAlive", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("allows the matching bearer token through to the route", () => {
    process.env.CRON_SECRET = "expected-secret";

    const response = proxy(
      new NextRequest("https://uniplans.example/api/keepAlive", {
        headers: { authorization: "Bearer expected-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

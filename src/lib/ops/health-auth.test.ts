import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { isHealthDetailAuthorized } from "@/lib/ops/health-auth";



function requestWithHeaders(headers: Record<string, string>) {

  return { headers: new Headers(headers) } as Parameters<typeof isHealthDetailAuthorized>[0];

}



describe("isHealthDetailAuthorized", () => {

  beforeEach(() => {

    process.env.HEALTH_CHECK_SECRET = "dedicated-health-secret";

    delete process.env.CRON_SECRET;

  });



  afterEach(() => {

    delete process.env.HEALTH_CHECK_SECRET;

    delete process.env.CRON_SECRET;

  });



  it("allows bearer health check secret", () => {

    expect(

      isHealthDetailAuthorized(

        requestWithHeaders({ authorization: "Bearer dedicated-health-secret" })

      )

    ).toBe(true);

  });



  it("allows x-health-key header", () => {

    expect(

      isHealthDetailAuthorized(requestWithHeaders({ "x-health-key": "dedicated-health-secret" }))

    ).toBe(true);

  });



  it("rejects cron secret fallback", () => {

    process.env.CRON_SECRET = "test-health-secret";

    expect(

      isHealthDetailAuthorized(

        requestWithHeaders({ authorization: "Bearer test-health-secret" })

      )

    ).toBe(false);

  });



  it("rejects missing or invalid credentials", () => {

    expect(isHealthDetailAuthorized(requestWithHeaders({}))).toBe(false);

    expect(

      isHealthDetailAuthorized(requestWithHeaders({ authorization: "Bearer wrong" }))

    ).toBe(false);

  });

});

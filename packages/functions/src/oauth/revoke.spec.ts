import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));

import { createFakeFirestore } from "../testing/fake-firestore";
import { config } from "../testing/mcp-fixtures";
import { handleRevoke } from "./revoke";

describe("handleRevoke", () => {
  it("rethrows failures that aren't OAuth errors", async () => {
    const failure = new Error("Firestore unavailable");
    const response = handleRevoke(
      new Request(`${config.issuer}/oauth/revoke`, {
        method: "POST",
        body: new URLSearchParams({
          client_id: "client_a",
          token: "board_at_x",
        }),
      }),
      {
        db: createFakeFirestore().asFirestore(),
        resolveClient: async () => {
          throw failure;
        },
      },
    );
    await expect(response).rejects.toBe(failure);
  });
});

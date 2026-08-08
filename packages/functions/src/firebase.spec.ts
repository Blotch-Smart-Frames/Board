import { describe, expect, it, vi, beforeEach } from "vitest";

const DEFAULT_APP_NAME = "[DEFAULT]";

const state = {
  apps: [] as { name: string }[],
  initSpy: vi.fn(),
  firestoreSpy: vi.fn(() => ({ __tag: "firestore" })),
  bucketSpy: vi.fn(() => ({ __tag: "bucket" })),
  storageSpy: vi.fn(() => ({ bucket: state.bucketSpy })),
};

vi.mock("firebase-admin/app", () => ({
  getApp: (name: string = DEFAULT_APP_NAME) => {
    const app = state.apps.find((a) => a.name === name);
    if (!app) {
      throw new Error(
        `The default Firebase app does not exist. Make sure you call initializeApp() before using any of the Firebase services.`,
      );
    }
    return app;
  },
  initializeApp: (...args: unknown[]) => {
    state.initSpy(...args);
    state.apps.push({ name: DEFAULT_APP_NAME });
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: (...args: unknown[]) => state.firestoreSpy(...args),
}));

vi.mock("firebase-admin/storage", () => ({
  getStorage: (...args: unknown[]) => state.storageSpy(...args),
}));

beforeEach(() => {
  state.apps = [];
  state.initSpy.mockClear();
  state.firestoreSpy.mockClear();
  state.bucketSpy.mockClear();
  state.storageSpy.mockClear();
});

describe("getDb", () => {
  it("initializes the Admin SDK on first use and returns a Firestore handle", async () => {
    const { getDb } = await import("./firebase");
    const db = getDb();
    expect(state.initSpy).toHaveBeenCalledTimes(1);
    expect(db).toEqual({ __tag: "firestore" });
  });

  it("does not reinitialize when the default app already exists", async () => {
    state.apps.push({ name: DEFAULT_APP_NAME });
    const { getDb } = await import("./firebase");
    getDb();
    expect(state.initSpy).not.toHaveBeenCalled();
  });

  it("initializes the default app even when only a named app is registered", async () => {
    // firebase-functions registers this app while verifying callable auth.
    state.apps.push({ name: "__FIREBASE_FUNCTIONS_SDK__" });
    const { getDb } = await import("./firebase");
    getDb();
    expect(state.initSpy).toHaveBeenCalledTimes(1);
    expect(state.apps.some((a) => a.name === DEFAULT_APP_NAME)).toBe(true);
  });
});

describe("getBucket", () => {
  it("returns the default storage bucket, initializing if needed", async () => {
    const { getBucket } = await import("./firebase");
    const bucket = getBucket();
    expect(state.initSpy).toHaveBeenCalledTimes(1);
    expect(state.bucketSpy).toHaveBeenCalledTimes(1);
    expect(bucket).toEqual({ __tag: "bucket" });
  });
});

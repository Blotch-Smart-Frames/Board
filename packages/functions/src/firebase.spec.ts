import { describe, expect, it, vi, beforeEach } from "vitest";

const state = {
  apps: [] as unknown[],
  initSpy: vi.fn(),
  firestoreSpy: vi.fn(() => ({ __tag: "firestore" })),
  bucketSpy: vi.fn(() => ({ __tag: "bucket" })),
  storageSpy: vi.fn(() => ({ bucket: state.bucketSpy })),
};

vi.mock("firebase-admin/app", () => ({
  getApps: () => state.apps,
  initializeApp: (...args: unknown[]) => {
    state.initSpy(...args);
    state.apps.push({});
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

  it("does not reinitialize when apps are already registered", async () => {
    state.apps.push({}); // simulate an app that already exists
    const { getDb } = await import("./firebase");
    getDb();
    expect(state.initSpy).not.toHaveBeenCalled();
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

import { describe, expect, it } from "vitest";
import { Timestamp, createFakeFirestore } from "../testing/fake-firestore";
import type { Board } from "@blotch/model";
import {
  ToolError,
  findMember,
  isMember,
  listAccessibleBoards,
  loadMembers,
  resolveList,
  resolveMembers,
  type Member,
} from "./board-data";

const ana: Member = { id: "u1", name: "Ana Smith", email: "ana@example.com", role: "owner" };

describe("isMember", () => {
  it("treats a board without collaborators as owner-only", () => {
    const board = { id: "b1", ownerId: "u1" } as Board;
    expect(isMember(board, "u1")).toBe(true);
    expect(isMember(board, "u2")).toBe(false);
  });
});

describe("listAccessibleBoards", () => {
  it("lists newest boards first, with undated boards last", async () => {
    const db = createFakeFirestore();
    db.seed("boards/legacy", { title: "Legacy", ownerId: "u1" });
    db.seed("boards/old", {
      title: "Old",
      ownerId: "u2",
      collaborators: ["u1"],
      createdAt: Timestamp.fromMillis(1_000),
    });
    db.seed("boards/new", { title: "New", ownerId: "u1", createdAt: Timestamp.fromMillis(2_000) });
    db.seed("boards/legacy-shared", { title: "Legacy shared", ownerId: "u2", collaborators: ["u1"] });
    db.seed("boards/other", { title: "Other", ownerId: "u2", createdAt: Timestamp.fromMillis(3_000) });

    const boards = await listAccessibleBoards(db.asFirestore(), "u1");

    expect(boards.slice(0, 2).map((board) => board.id)).toEqual(["new", "old"]);
    expect(boards.slice(2).map((board) => board.id).sort()).toEqual(["legacy", "legacy-shared"]);
  });
});

describe("loadMembers", () => {
  it("falls back to the email, then a placeholder, when a profile is incomplete", async () => {
    const db = createFakeFirestore();
    db.seed("users/u1", { email: "ana@example.com" });

    expect(await loadMembers(db.asFirestore(), { id: "b1", ownerId: "u1" } as Board)).toEqual([
      { id: "u1", name: "ana@example.com", email: "ana@example.com", role: "owner" },
    ]);
    expect(
      await loadMembers(db.asFirestore(), {
        id: "b1",
        ownerId: "u1",
        collaborators: ["u2", "u1"],
      } as Board),
    ).toEqual([
      { id: "u1", name: "ana@example.com", email: "ana@example.com", role: "owner" },
      { id: "u2", name: "Unknown user", email: "", role: "collaborator" },
    ]);
  });
});

describe("resolveList", () => {
  it("says when a board has no lists", () => {
    expect(() => resolveList([], "To Do")).toThrow(
      new ToolError('No list matches "To Do". Lists on this board: (none).'),
    );
  });
});

describe("findMember", () => {
  it("refuses to guess between members who share a name", () => {
    const other: Member = { ...ana, id: "u2", name: "Ana Jones", email: "jones@example.com" };
    expect(() => findMember([ana, other], "ana", "u1")).toThrow(
      'More than one member matches "ana" (Ana Smith, Ana Jones); use their email instead.',
    );
    expect(() => findMember([ana, { ...other, name: "Ana Smith" }], "Ana Smith", "u1")).toThrow(
      /More than one member matches "Ana Smith"/,
    );
  });
});

describe("resolveMembers", () => {
  it("lists members without an email by name alone", () => {
    const unknown: Member = { id: "u2", name: "Unknown user", email: "", role: "collaborator" };
    expect(() => resolveMembers([ana, unknown], ["Zed"], "u1")).toThrow(
      'No member of this board matches "Zed". Members: Ana Smith <ana@example.com>, Unknown user. Only board members can be assigned.',
    );
  });
});

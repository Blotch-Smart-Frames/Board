/**
 * In-memory stand-in for the slice of the Admin Firestore API the MCP server
 * and OAuth endpoints use: documents, sub-collections, simple queries, batches,
 * transactions and the FieldValue sentinels. Tests swap it in for the real
 * module with
 *
 *   vi.mock("firebase-admin/firestore", () => import("../testing/fake-firestore"));
 *
 * so `FieldValue` / `Timestamp` imported by the code under test resolve to the
 * classes below, which `FakeFirestore` knows how to apply. Only the behavior
 * the code relies on is modeled — this is not a general Firestore emulator.
 */

export class Timestamp {
  constructor(
    readonly seconds: number,
    readonly nanoseconds: number,
  ) {}

  static fromMillis(millis: number): Timestamp {
    const seconds = Math.floor(millis / 1000);
    return new Timestamp(seconds, (millis - seconds * 1000) * 1_000_000);
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }
}

type Sentinel =
  | { kind: "serverTimestamp" }
  | { kind: "increment"; by: number }
  | { kind: "arrayUnion"; values: unknown[] }
  | { kind: "arrayRemove"; values: unknown[] }
  | { kind: "delete" };

class FieldValueSentinel {
  constructor(readonly op: Sentinel) {}
}

export const FieldValue = {
  serverTimestamp: () => new FieldValueSentinel({ kind: "serverTimestamp" }),
  increment: (by: number) => new FieldValueSentinel({ kind: "increment", by }),
  arrayUnion: (...values: unknown[]) =>
    new FieldValueSentinel({ kind: "arrayUnion", values }),
  arrayRemove: (...values: unknown[]) =>
    new FieldValueSentinel({ kind: "arrayRemove", values }),
  delete: () => new FieldValueSentinel({ kind: "delete" }),
};

type Data = Record<string, unknown>;

function isPlainObject(value: unknown): value is Data {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

// Deep copy that keeps Timestamps (immutable) as-is, so stored data never
// aliases what the caller holds.
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, clone(v)]),
    ) as T;
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Timestamp && b instanceof Timestamp) {
    return a.toMillis() === b.toMillis();
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function applySentinel(current: unknown, op: Sentinel): unknown {
  switch (op.kind) {
    case "serverTimestamp":
      return Timestamp.now();
    case "increment":
      return (typeof current === "number" ? current : 0) + op.by;
    case "arrayUnion": {
      const next = Array.isArray(current) ? [...current] : [];
      for (const value of op.values) {
        if (!next.some((v) => sameValue(v, value))) next.push(value);
      }
      return next;
    }
    case "arrayRemove":
      return (Array.isArray(current) ? current : []).filter(
        (v) => !op.values.some((value) => sameValue(v, value)),
      );
    case "delete":
      return undefined;
  }
}

function resolveValues(data: Data, existing: Data): Data {
  const out: Data = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof FieldValueSentinel) {
      const next = applySentinel(existing[key], value.op);
      if (next !== undefined) out[key] = next;
    } else if (isPlainObject(value)) {
      const nested = existing[key];
      out[key] = resolveValues(value, isPlainObject(nested) ? nested : {});
    } else {
      out[key] = clone(value);
    }
  }
  return out;
}

function getField(data: Data, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) => (isPlainObject(value) ? value[key] : undefined),
      data,
    );
}

function comparable(value: unknown): unknown {
  return value instanceof Timestamp ? value.toMillis() : value;
}

function compare(a: unknown, b: unknown): number {
  const x = comparable(a) as number | string;
  const y = comparable(b) as number | string;
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

type WhereOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "array-contains";

type Filter = { field: string; op: WhereOp; value: unknown };

function matches(data: Data, filter: Filter): boolean {
  const actual = getField(data, filter.field);
  // Like Firestore, a filter never matches a document missing the field.
  if (actual === undefined) return false;
  switch (filter.op) {
    case "==":
      return sameValue(actual, filter.value);
    case "!=":
      return !sameValue(actual, filter.value);
    case "<":
      return compare(actual, filter.value) < 0;
    case "<=":
      return compare(actual, filter.value) <= 0;
    case ">":
      return compare(actual, filter.value) > 0;
    case ">=":
      return compare(actual, filter.value) >= 0;
    case "in":
      return (filter.value as unknown[]).some((v) => sameValue(actual, v));
    case "array-contains":
      return (
        Array.isArray(actual) && actual.some((v) => sameValue(v, filter.value))
      );
  }
}

let autoId = 0;
function nextId(): string {
  autoId += 1;
  return `auto-${autoId.toString().padStart(4, "0")}`;
}

export class FakeDocumentSnapshot {
  constructor(
    readonly ref: FakeDocumentReference,
    private readonly stored: Data | undefined,
  ) {}

  get id(): string {
    return this.ref.id;
  }

  get exists(): boolean {
    return this.stored !== undefined;
  }

  data(): Data | undefined {
    return this.stored === undefined ? undefined : clone(this.stored);
  }

  get(field: string): unknown {
    return this.stored === undefined ? undefined : getField(this.stored, field);
  }
}

export class FakeQuerySnapshot {
  constructor(readonly docs: FakeDocumentSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }
}

export class FakeDocumentReference {
  constructor(
    readonly firestore: FakeFirestore,
    readonly path: string,
  ) {}

  get id(): string {
    return this.path.split("/").pop() as string;
  }

  get parent(): FakeCollectionReference {
    return new FakeCollectionReference(
      this.firestore,
      this.path.split("/").slice(0, -1).join("/"),
    );
  }

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(this.firestore, `${this.path}/${name}`);
  }

  async get(): Promise<FakeDocumentSnapshot> {
    return this.firestore.snapshot(this);
  }

  async set(data: Data, options?: { merge?: boolean }): Promise<void> {
    this.firestore.write({ type: "set", ref: this, data, merge: options?.merge });
  }

  async create(data: Data): Promise<void> {
    this.firestore.write({ type: "create", ref: this, data });
  }

  async update(data: Data): Promise<void> {
    this.firestore.write({ type: "update", ref: this, data });
  }

  async delete(): Promise<void> {
    this.firestore.write({ type: "delete", ref: this });
  }
}

export class FakeQuery {
  constructor(
    readonly firestore: FakeFirestore,
    readonly path: string,
    protected readonly filters: Filter[] = [],
    protected readonly orders: { field: string; dir: "asc" | "desc" }[] = [],
    protected readonly max?: number,
  ) {}

  where(field: string, op: WhereOp, value: unknown): FakeQuery {
    return new FakeQuery(
      this.firestore,
      this.path,
      [...this.filters, { field, op, value }],
      this.orders,
      this.max,
    );
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc"): FakeQuery {
    return new FakeQuery(
      this.firestore,
      this.path,
      this.filters,
      [...this.orders, { field, dir }],
      this.max,
    );
  }

  limit(max: number): FakeQuery {
    return new FakeQuery(
      this.firestore,
      this.path,
      this.filters,
      this.orders,
      max,
    );
  }

  async get(): Promise<FakeQuerySnapshot> {
    return this.firestore.runQuery(this.path, this.filters, this.orders, this.max);
  }
}

export class FakeCollectionReference extends FakeQuery {
  get id(): string {
    return this.path.split("/").pop() as string;
  }

  doc(id?: string): FakeDocumentReference {
    return new FakeDocumentReference(this.firestore, `${this.path}/${id ?? nextId()}`);
  }

  async add(data: Data): Promise<FakeDocumentReference> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

type Write =
  | { type: "set"; ref: FakeDocumentReference; data: Data; merge?: boolean }
  | { type: "create"; ref: FakeDocumentReference; data: Data }
  | { type: "update"; ref: FakeDocumentReference; data: Data }
  | { type: "delete"; ref: FakeDocumentReference };

class FakeWriteBatch {
  private readonly writes: Write[] = [];

  constructor(private readonly firestore: FakeFirestore) {}

  set(ref: FakeDocumentReference, data: Data, options?: { merge?: boolean }) {
    this.writes.push({ type: "set", ref, data, merge: options?.merge });
    return this;
  }

  create(ref: FakeDocumentReference, data: Data) {
    this.writes.push({ type: "create", ref, data });
    return this;
  }

  update(ref: FakeDocumentReference, data: Data) {
    this.writes.push({ type: "update", ref, data });
    return this;
  }

  delete(ref: FakeDocumentReference) {
    this.writes.push({ type: "delete", ref });
    return this;
  }

  async commit(): Promise<void> {
    this.firestore.commit(this.writes);
  }
}

class FakeTransaction extends FakeWriteBatch {
  private wrote = false;

  override set(ref: FakeDocumentReference, data: Data, options?: { merge?: boolean }) {
    this.wrote = true;
    return super.set(ref, data, options);
  }

  override create(ref: FakeDocumentReference, data: Data) {
    this.wrote = true;
    return super.create(ref, data);
  }

  override update(ref: FakeDocumentReference, data: Data) {
    this.wrote = true;
    return super.update(ref, data);
  }

  override delete(ref: FakeDocumentReference) {
    this.wrote = true;
    return super.delete(ref);
  }

  async get(
    target: FakeDocumentReference | FakeQuery,
  ): Promise<FakeDocumentSnapshot | FakeQuerySnapshot> {
    // The real SDK rejects this too: every read must precede the first write.
    if (this.wrote) {
      throw new Error("Firestore transactions require all reads before all writes.");
    }
    return target.get();
  }
}

/** Error shaped like the Firestore SDK's, carrying a gRPC status `code`. */
export class FakeFirestoreError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export class FakeFirestore {
  private readonly docs = new Map<string, Data>();

  collection(path: string): FakeCollectionReference {
    return new FakeCollectionReference(this, path);
  }

  doc(path: string): FakeDocumentReference {
    return new FakeDocumentReference(this, path);
  }

  batch(): FakeWriteBatch {
    return new FakeWriteBatch(this);
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const result = await fn(tx);
    await tx.commit();
    return result;
  }

  async getAll(...refs: FakeDocumentReference[]): Promise<FakeDocumentSnapshot[]> {
    return refs.map((ref) => this.snapshot(ref));
  }

  async recursiveDelete(ref: FakeDocumentReference): Promise<void> {
    for (const path of [...this.docs.keys()]) {
      if (path === ref.path || path.startsWith(`${ref.path}/`)) {
        this.docs.delete(path);
      }
    }
  }

  // --- Test helpers ---------------------------------------------------------

  /** Seed (or overwrite) a document directly, bypassing sentinels. */
  seed(path: string, data: Data): void {
    this.docs.set(path, clone(data));
  }

  /** Read a document's raw stored data, or undefined when absent. */
  read(path: string): Data | undefined {
    const stored = this.docs.get(path);
    return stored === undefined ? undefined : clone(stored);
  }

  /** Paths of every document directly inside a collection. */
  list(collectionPath: string): string[] {
    const depth = collectionPath.split("/").length + 1;
    return [...this.docs.keys()]
      .filter(
        (path) =>
          path.startsWith(`${collectionPath}/`) &&
          path.split("/").length === depth,
      )
      .sort();
  }

  // --- Internals used by references -----------------------------------------

  snapshot(ref: FakeDocumentReference): FakeDocumentSnapshot {
    return new FakeDocumentSnapshot(ref, this.docs.get(ref.path));
  }

  runQuery(
    path: string,
    filters: Filter[],
    orders: { field: string; dir: "asc" | "desc" }[],
    max?: number,
  ): FakeQuerySnapshot {
    let docs = this.list(path)
      .map((docPath) => ({ docPath, data: this.docs.get(docPath) as Data }))
      .filter(({ data }) => filters.every((filter) => matches(data, filter)));
    for (const { field } of orders) {
      // Firestore drops documents missing an orderBy field.
      docs = docs.filter(({ data }) => getField(data, field) !== undefined);
    }
    docs.sort((a, b) => {
      for (const { field, dir } of orders) {
        const result = compare(getField(a.data, field), getField(b.data, field));
        if (result !== 0) return dir === "asc" ? result : -result;
      }
      return 0;
    });
    const limited = max === undefined ? docs : docs.slice(0, max);
    return new FakeQuerySnapshot(
      limited.map(({ docPath, data }) =>
        new FakeDocumentSnapshot(new FakeDocumentReference(this, docPath), data),
      ),
    );
  }

  write(write: Write): void {
    this.commit([write]);
  }

  commit(writes: Write[]): void {
    // Validate every write first so a failing batch applies nothing.
    for (const write of writes) {
      const exists = this.docs.has(write.ref.path);
      if (write.type === "update" && !exists) {
        throw new FakeFirestoreError(5, `No document to update: ${write.ref.path}`);
      }
      if (write.type === "create" && exists) {
        throw new FakeFirestoreError(6, `Document already exists: ${write.ref.path}`);
      }
    }
    for (const write of writes) {
      const path = write.ref.path;
      const existing = this.docs.get(path) ?? {};
      switch (write.type) {
        case "delete":
          this.docs.delete(path);
          break;
        case "set":
        case "create":
          this.docs.set(
            path,
            write.type === "set" && write.merge
              ? { ...existing, ...resolveValues(write.data, existing) }
              : resolveValues(write.data, {}),
          );
          break;
        case "update": {
          const next = clone(existing);
          for (const [field, value] of Object.entries(write.data)) {
            const keys = field.split(".");
            const last = keys.pop() as string;
            let target = next;
            for (const key of keys) {
              if (!isPlainObject(target[key])) target[key] = {};
              target = target[key] as Data;
            }
            const resolved =
              value instanceof FieldValueSentinel
                ? applySentinel(target[last], value.op)
                : clone(value);
            if (resolved === undefined) delete target[last];
            else target[last] = resolved;
          }
          this.docs.set(path, next);
          break;
        }
      }
    }
  }
}

/**
 * The fake typed as the Admin SDK's `Firestore`, for handing to code under
 * test. The fake implements only what that code calls.
 */
export function createFakeFirestore(): FakeFirestore & {
  asFirestore(): import("firebase-admin/firestore").Firestore;
} {
  const db = new FakeFirestore() as FakeFirestore & {
    asFirestore(): import("firebase-admin/firestore").Firestore;
  };
  db.asFirestore = () =>
    db as unknown as import("firebase-admin/firestore").Firestore;
  return db;
}

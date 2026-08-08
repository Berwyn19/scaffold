// JSON-file implementation of Store.
//
// Reads the document into memory on construction, applies ops in memory via the
// shared reducer, and writes the whole document back to disk after each op.
// Human-inspectable and trivial, which is exactly what we want for early phases.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Document } from "@core/types.js";
import { applyOp, type Op } from "@core/operations.js";
import type { Store } from "./Store.js";

export class FileStore implements Store {
  private doc: Document;

  constructor(private readonly path: string) {
    this.doc = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as Document)
      : { id: "root", blocks: [] };
  }

  get(): Document {
    return this.doc;
  }

  apply(op: Op): Document {
    this.doc = applyOp(this.doc, op);
    writeFileSync(this.path, JSON.stringify(this.doc, null, 2));
    return this.doc;
  }
}

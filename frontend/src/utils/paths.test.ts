import assert from "node:assert/strict";
import { test } from "node:test";
import { fsPathToNoteUrl, noteUrlToFsPath } from "./paths.ts";

test("round-trips a note whose title contains spaces", () => {
  const fs = "home/technology/Media server migration.md";
  const url = fsPathToNoteUrl(fs);
  assert.equal(url, "/note/home/technology/Media%20server%20migration");
  assert.equal(noteUrlToFsPath(url.slice("/note/".length)), fs);
});

test("decodes %20 left in the route pathname", () => {
  assert.equal(
    noteUrlToFsPath("home/technology/Media%20server%20migration"),
    "home/technology/Media server migration.md",
  );
});

test("accepts an already-decoded pathname with spaces", () => {
  assert.equal(
    noteUrlToFsPath("home/technology/Media server migration"),
    "home/technology/Media server migration.md",
  );
});

test("does not encode slashes between directories", () => {
  assert.equal(fsPathToNoteUrl("home/solar.md"), "/note/home/solar");
  assert.equal(noteUrlToFsPath("home/solar"), "home/solar.md");
});

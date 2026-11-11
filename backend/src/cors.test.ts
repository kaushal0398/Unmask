import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corsOrigins } from "./cors.js";

describe("corsOrigins", () => {
  it("always allows the two local addresses", () => assert.deepEqual(corsOrigins(undefined), ["http://localhost:3000", "http://127.0.0.1:3000"]));
  it("adds deployed origins, trimming spaces and trailing slashes, without duplicates", () => {
    assert.deepEqual(corsOrigins(" https://unmask.example.com/ , http://localhost:3000,https://b.example.com"), ["http://localhost:3000", "http://127.0.0.1:3000", "https://unmask.example.com", "https://b.example.com"]);
  });
  it("refuses a wildcard or an entry with a path, because the API takes a bearer token from the browser", () => {
    assert.throws(() => corsOrigins("*"), /invalid entry/);
    assert.throws(() => corsOrigins("https://*.example.com"), /invalid entry/);
    assert.throws(() => corsOrigins("https://example.com/app"), /invalid entry/);
    assert.throws(() => corsOrigins("example.com"), /invalid entry/);
  });
});

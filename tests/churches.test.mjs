import { test } from "node:test";
import assert from "node:assert/strict";
import { titleCaseName, looksLikeChurch } from "../src/lib/community/churches.ts";

test("registry names in ALL CAPS read like a sign", () => {
  assert.equal(titleCaseName("FIRST BAPTIST CHURCH OF VIDALIA"), "First Baptist Church of Vidalia");
  assert.equal(titleCaseName("ST PAUL AME CHURCH"), "St Paul AME Church");
  assert.equal(titleCaseName("Grace Fellowship"), "Grace Fellowship");
});

test("non-congregation rows with no service info are hidden", () => {
  assert.equal(looksLikeChurch({ name: "Day After Today" }), false);
  assert.equal(looksLikeChurch({ name: "Day After Today", service_times: "Sun 11am" }), true);
  assert.equal(looksLikeChurch({ name: "Mt Zion Missionary Baptist" }), true);
});

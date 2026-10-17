import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeNext, safeNext, isEventNext } from "../src/lib/safe-next.ts";

test("safe next: same-origin paths only", () => {
  assert.equal(safeNext("/e/board%3Aevt_vidalia_dads_coffee?rsvp=1"), "/e/board%3Aevt_vidalia_dads_coffee?rsvp=1");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/x?u=http://a", "", null, 42, "e/x", "/a\nb"]) {
    assert.equal(isSafeNext(bad), false, String(bad));
    assert.equal(safeNext(bad), "/app");
  }
  assert.equal(isEventNext("/e/board:x?rsvp=1"), true);
  assert.equal(isEventNext("/app"), false);
});

import { pantrySourceLine } from "../src/lib/community/pantry.ts";

test("pantry source line reads like a person wrote it", () => {
  assert.equal(
    pantrySourceLine({ source_name: "Plenty field visit (plenty.unitedundergod.org/around)", verified_on: "2026-10-17", listed_by_name: "" }),
    "From a Plenty visit · checked Oct 17",
  );
  assert.equal(
    pantrySourceLine({ source_name: "Plenty (plenty.unitedundergod.org)", verified_on: "", listed_by_name: "" }),
    "From Plenty",
  );
});

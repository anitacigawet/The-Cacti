import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, csvRows } from "./csv.js";

test("CSV quotes every field and preserves ordinary text", () => {
  assert.equal(csvRows([["Title", "City"], ['A, "quoted" title', "Kingman\nArizona"]]), '"Title","City"\r\n"A, ""quoted"" title","Kingman\nArizona"');
  assert.equal(csvCell(null), '""');
});
test("CSV neutralizes formula and control-prefix classes in every column", () => {
  for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", " \t=1", "\u0000=1", "\rhello", "\nhello", "\thello"]) {
    assert.ok(csvCell(value).startsWith('"\''), JSON.stringify(value));
  }
});

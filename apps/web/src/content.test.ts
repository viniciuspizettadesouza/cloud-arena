import { describe, expect, it } from "vitest";

import { FOUNDATION_STATUS, HOME_HEADING } from "./content";

describe("web shell content", () => {
  it("keeps the foundation messaging stable", () => {
    expect(HOME_HEADING).toBe("Compare clouds with evidence");
    expect(FOUNDATION_STATUS).toBe("Foundation ready");
  });
});

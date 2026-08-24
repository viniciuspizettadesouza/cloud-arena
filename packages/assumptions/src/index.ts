import type { CloudProvider } from "@cloud-arena/domain";

export interface AssumptionContext {
  provider?: CloudProvider;
}

export const ASSUMPTIONS_PACKAGE = "@cloud-arena/assumptions" as const;

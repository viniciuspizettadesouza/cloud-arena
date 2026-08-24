import type { CloudProvider } from "@cloud-arena/domain";

export interface ScoreContext {
  provider: CloudProvider;
}

export const SCORING_PACKAGE = "@cloud-arena/scoring" as const;

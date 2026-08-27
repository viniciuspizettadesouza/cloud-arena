export {
  DEFAULT_SCORING_CONFIG_PATH,
  loadScoringConfig,
  parseScoringConfig,
  scoreDimensionIdSchema,
  scoringConfigSchema,
  type ScoreDimensionId,
  type ScoringConfig,
} from "./config.js";
export {
  candidateScoreSchema,
  scoreCandidates,
  scoreClassificationSchema,
  scoreDimensionSchema,
  scoreSourceTypeSchema,
  type CandidateCostInput,
  type CandidateScore,
  type ScoreDimension,
  type ScoringCandidate,
} from "./score.js";

export const SCORING_PACKAGE = "@cloud-arena/scoring" as const;

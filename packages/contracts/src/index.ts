import type { CloudProvider } from "@cloud-arena/domain";

export interface ProviderReference {
  provider: CloudProvider;
}

export const CONTRACTS_PACKAGE = "@cloud-arena/contracts" as const;

import type { CloudProvider } from "@cloud-arena/domain";

export interface CatalogRecordIdentity {
  id: string;
  provider: CloudProvider;
}

export const CATALOG_PACKAGE = "@cloud-arena/catalog" as const;

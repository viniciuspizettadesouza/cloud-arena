export const CLOUD_PROVIDERS = ["aws", "azure", "gcp"] as const;

export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export const DOMAIN_PACKAGE = "@cloud-arena/domain" as const;

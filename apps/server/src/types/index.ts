export type HostedAuthConfig = {
  hostedMode: boolean;
  bearerToken?: string;
};

export type CorsConfig = {
  allowedOrigins: string[];
  allowNullOrigin?: boolean;
};

export type SyncHttpMetadata = {
  etag?: string;
  lastModified?: string;
};

export type SyncResourceState = {
  url: string;
  metadata: SyncHttpMetadata;
  contentHash?: string;
  embeddedAt?: string;
};

import { kv } from "@vercel/kv";

import { getEnvValue } from "./env.js";

const requiredEnvNames = ["KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;

export function getRedisConfigurationError(): string | undefined {
  const missingNames = requiredEnvNames.filter((name) => getEnvValue(name) === undefined);

  if (missingNames.length === 0) {
    return undefined;
  }

  return `Redis is not configured. Missing environment variables: ${missingNames.join(", ")}.`;
}

export const redis = kv;

export function isGarminEnabled(): boolean {
  return !!process.env.GARMIN_AUTH_PROXY_URL;
}

export function isAIEnabled(): boolean {
  return !!process.env.AI_GATEWAY_API_KEY;
}

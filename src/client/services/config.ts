interface ClientConfig {
  storeDomain: string;
}

let cachedConfig: ClientConfig | null = null;

export async function getClientConfig(): Promise<ClientConfig> {
  if (cachedConfig) return cachedConfig;

  const response = await fetch('/api/config/client');
  cachedConfig = await response.json();
  return cachedConfig;
}

export function extractShopName(storeUrl: string, domain: string): string {
  return storeUrl.replace(`.${domain}`, '');
}

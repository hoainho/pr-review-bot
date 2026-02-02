export interface QuotaStatus {
  provider: string;
  totalRequests: number;
  failedRequests: number;
  lastError: string | null;
  lastUsed: number;
  isExhausted: boolean;
  cooldownRemaining: number;
}

const quotaRegistry: Map<string, QuotaStatus> = new Map();
const COOLDOWN_MS = 60000;

export function initQuotaTracking(provider: string): QuotaStatus {
  const existing = quotaRegistry.get(provider);
  if (existing) return existing;

  const status: QuotaStatus = {
    provider,
    totalRequests: 0,
    failedRequests: 0,
    lastError: null,
    lastUsed: 0,
    isExhausted: false,
    cooldownRemaining: 0
  };
  quotaRegistry.set(provider, status);
  return status;
}

export function recordRequest(provider: string, success: boolean, error?: string): void {
  const status = initQuotaTracking(provider);
  status.totalRequests++;
  status.lastUsed = Date.now();

  if (!success) {
    status.failedRequests++;
    status.lastError = error || 'Unknown error';
    status.isExhausted = true;
    status.cooldownRemaining = COOLDOWN_MS;
  } else {
    status.isExhausted = false;
    status.lastError = null;
  }
}

export function getQuotaStatus(provider: string): QuotaStatus | null {
  const status = quotaRegistry.get(provider);
  if (!status) return null;

  if (status.cooldownRemaining > 0) {
    status.cooldownRemaining = Math.max(0, COOLDOWN_MS - (Date.now() - status.lastUsed));
    if (status.cooldownRemaining === 0) {
      status.isExhausted = false;
    }
  }

  return { ...status };
}

export function getAllQuotaStatus(): QuotaStatus[] {
  const statuses: QuotaStatus[] = [];
  for (const [provider, status] of quotaRegistry) {
    statuses.push(getQuotaStatus(provider)!);
  }
  return statuses;
}

export function clearQuotaExhaustion(provider: string): void {
  const status = quotaRegistry.get(provider);
  if (status) {
    status.isExhausted = false;
    status.cooldownRemaining = 0;
    status.lastError = null;
  }
}

export function clearAllQuotaExhaustion(): void {
  for (const [provider] of quotaRegistry) {
    clearQuotaExhaustion(provider);
  }
}

export function getBestAvailableProvider(providers: string[]): string | null {
  let bestProvider: string | null = null;
  let lowestFailureRate = Infinity;

  for (const provider of providers) {
    const status = getQuotaStatus(provider);
    if (!status || status.isExhausted) continue;

    const failureRate = status.totalRequests > 0
      ? status.failedRequests / status.totalRequests
      : 0;

    if (failureRate < lowestFailureRate) {
      lowestFailureRate = failureRate;
      bestProvider = provider;
    }
  }

  return bestProvider;
}

export function getQuotaSummary(): string {
  const lines: string[] = ['=== Quota Status Summary ==='];
  for (const [provider, status] of quotaRegistry) {
    const health = status.isExhausted ? '🔴 EXHAUSTED' : '🟢 OK';
    const cooldown = status.cooldownRemaining > 0
      ? ` (${Math.round(status.cooldownRemaining / 1000)}s cooldown)`
      : '';
    const failureRate = status.totalRequests > 0
      ? `${((status.failedRequests / status.totalRequests) * 100).toFixed(1)}%`
      : 'N/A';

    lines.push(`${provider}:`);
    lines.push(`  Status: ${health}${cooldown}`);
    lines.push(`  Requests: ${status.totalRequests} (${failureRate} failures)`);
  }
  return lines.join('\n');
}

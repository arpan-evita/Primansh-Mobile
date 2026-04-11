export function extractOfflineErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message || '').trim();
    if (message) return message;
  }

  return fallback;
}

export function isRetriableOfflineError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message || '')
        : '';

  const normalized = message.toLowerCase();
  return (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('offline') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network request failed') ||
    normalized.includes('connection') ||
    normalized.includes('timed out')
  );
}

export function scopedStorageKey(baseKey: string, ownerId: string | null) {
  return ownerId ? `${baseKey}:${ownerId}` : baseKey;
}

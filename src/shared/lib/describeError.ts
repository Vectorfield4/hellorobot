interface CodedError extends Error {
  code?: string;
  cause?: unknown;
  errors?: unknown[];
}

/**
 * Node прячет настоящую причину сетевого сбоя в `error.cause`, а наружу отдаёт
 * только `TypeError: fetch failed`. Без этой цепочки в логе не отличить
 * ENOTFOUND (DNS) от ECONNRESET (оборванное соединение) и от ошибки сертификата.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const err = current as CodedError;
    const message = typeof err.message === "string" && err.message ? err.message : String(current);
    const text = err.code && !message.includes(err.code) ? `${err.code}: ${message}` : message;
    if (text && !parts.includes(text)) parts.push(text);
    current = err.cause ?? (Array.isArray(err.errors) ? err.errors[0] : undefined);
  }

  return parts.length ? parts.join(" <- ") : String(error);
}

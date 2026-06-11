// Ingestion error logging contract
// This file defines the small internal shape used before any Prisma write. It
// keeps source context, stable error codes and sanitized messages separated from
// raw external errors.
export const DEFAULT_INGESTION_ERROR_HISTORY_LIMIT = 20;
export const MAX_INGESTION_ERROR_MESSAGE_LENGTH = 500;
export const MAX_INGESTION_ERROR_TYPE_LENGTH = 120;

export interface IngestionErrorLogSource {
  id: string;
  status: string;
}

export interface IngestionErrorLogInput {
  source: IngestionErrorLogSource;
  errorType: string;
  message?: string | null;
  occurredAt?: Date;
}

export interface IngestionErrorLogEntry {
  sourceId: string;
  occurredAt: Date;
  errorType: string;
  message: string;
  sourceStatus: string;
}

export interface IngestionErrorLogPersistenceResult {
  ingestionErrorId: string;
}

// Persistence port
// The concrete Prisma implementation will arrive in a later micro-increment.
// Tests can provide this interface directly, like an Express service receiving
// a mocked repository instead of importing the database client everywhere.
export interface IngestionErrorLogPersistencePort {
  createIngestionError(
    entry: IngestionErrorLogEntry,
  ): Promise<IngestionErrorLogPersistenceResult>;
  pruneIngestionErrorsForSource(
    sourceId: string,
    keepLatest: number,
  ): Promise<void>;
}

export interface RecordIngestionErrorDependencies {
  persistence: IngestionErrorLogPersistencePort;
  historyLimit?: number;
}

const FALLBACK_INGESTION_ERROR_TYPE = 'ingestion.unknown';
const FALLBACK_INGESTION_ERROR_MESSAGE =
  'Ingestion failed with a non-sensitive internal error code.';
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const SAFE_ERROR_TYPE_PATTERN = /^[a-zA-Z0-9._:-]+$/;
const SUSPICIOUS_MESSAGE_PATTERNS = [
  /<\s*(?:!doctype|html|head|body|script|style|rss|feed|entry|item|article|main|section|div|span|meta|title)\b/i,
  /(?:token|secret|api[_-]?key|authorization|bearer|password)\s*[:=]/i,
  /-----BEGIN [A-Z ]+-----/,
  /\bat\s+(?:\S+\s+\(|file:|node:internal\/|.*\.(?:ts|js):\d+:\d+)/i,
];

function normalizeWhitespace(input: string): string {
  return input
    .replace(CONTROL_CHARACTER_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength - 3).trimEnd()}...`;
}

function isSuspiciousMessage(input: string): boolean {
  return SUSPICIOUS_MESSAGE_PATTERNS.some((pattern) => pattern.test(input));
}

// Stable error type normalization
// Error types are technical identifiers, not user-facing text. Restricting the
// charset prevents accidental storage of payload fragments in the indexed field.
export function sanitizeIngestionErrorType(errorType: string): string {
  const normalizedErrorType = normalizeWhitespace(errorType);

  if (
    normalizedErrorType.length === 0 ||
    normalizedErrorType.length > MAX_INGESTION_ERROR_TYPE_LENGTH ||
    !SAFE_ERROR_TYPE_PATTERN.test(normalizedErrorType)
  ) {
    return FALLBACK_INGESTION_ERROR_TYPE;
  }

  return normalizedErrorType;
}

// Message sanitization
// The message may come from a known issue label, but never from a raw provider
// response. If it looks like HTML, XML, a stack trace or a secret-bearing line,
// StackVault stores a neutral fallback instead.
export function sanitizeIngestionErrorMessage(
  message: string | null | undefined,
): string {
  if (message === null || message === undefined) {
    return FALLBACK_INGESTION_ERROR_MESSAGE;
  }

  const normalizedMessage = normalizeWhitespace(message);

  if (
    normalizedMessage.length === 0 ||
    isSuspiciousMessage(normalizedMessage)
  ) {
    return FALLBACK_INGESTION_ERROR_MESSAGE;
  }

  return truncate(normalizedMessage, MAX_INGESTION_ERROR_MESSAGE_LENGTH);
}

// Log entry mapping
// This pure mapper is the single place where external ingestion reports become
// rows ready for persistence. Later increments can call it from RSS/Atom and
// public metadata runners without duplicating the safety rules.
export function buildIngestionErrorLogEntry(
  input: IngestionErrorLogInput,
): IngestionErrorLogEntry {
  return {
    sourceId: input.source.id,
    occurredAt: input.occurredAt ?? new Date(),
    errorType: sanitizeIngestionErrorType(input.errorType),
    message: sanitizeIngestionErrorMessage(input.message),
    sourceStatus: input.source.status,
  };
}

function resolveHistoryLimit(historyLimit: number | undefined): number {
  if (
    historyLimit === undefined ||
    !Number.isInteger(historyLimit) ||
    historyLimit < 1
  ) {
    return DEFAULT_INGESTION_ERROR_HISTORY_LIMIT;
  }

  return historyLimit;
}

// Error log orchestration
// Recording and pruning stay together so every write applies the same retention
// rule. The database implementation remains behind the port, which keeps this
// function easy to test without a real Prisma client.
export async function recordIngestionError(
  input: IngestionErrorLogInput,
  dependencies: RecordIngestionErrorDependencies,
): Promise<IngestionErrorLogPersistenceResult> {
  const entry = buildIngestionErrorLogEntry(input);
  const result = await dependencies.persistence.createIngestionError(entry);

  await dependencies.persistence.pruneIngestionErrorsForSource(
    entry.sourceId,
    resolveHistoryLimit(dependencies.historyLimit),
  );

  return result;
}

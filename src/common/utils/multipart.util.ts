import { plainToInstance } from 'class-transformer';

type ValueParam = { value: unknown };

/** Treat blank multipart/query values as omitted (IsOptional only skips null/undefined). */
export function emptyToUndefined({ value }: ValueParam): unknown {
  if (value === '' || value === null) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}

/** Coerce multipart/query strings to numbers; blank → undefined. */
export function toOptionalNumber({ value }: ValueParam): unknown {
  const cleaned = emptyToUndefined({ value });
  if (cleaned === undefined) return undefined;
  if (typeof cleaned === 'number') {
    return Number.isFinite(cleaned) ? cleaned : cleaned;
  }
  if (typeof cleaned === 'string') {
    const trimmed = cleaned.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : cleaned;
  }
  return cleaned;
}

/** Required numeric fields from multipart (empty stays empty so validation fails clearly). */
export function toNumber({ value }: ValueParam): unknown {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

export function parseJsonField({ value }: ValueParam): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseStringArray({ value }: ValueParam): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return trimmed.includes(',')
    ? trimmed.split(',').map((item) => item.trim()).filter(Boolean)
    : [trimmed];
}

export function parseNestedDto<T extends object>(cls: new () => T) {
  return ({ value }: ValueParam): unknown => {
    const parsed = parseJsonField({ value });
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyToUndefined({ value: parsed });
    }
    return plainToInstance(cls, parsed);
  };
}

/** Explore "All" chip sends purpose=all — treat as no filter. */
export function normalizePurpose({ value }: ValueParam): unknown {
  const cleaned = emptyToUndefined({ value });
  if (cleaned === undefined) return undefined;
  const normalized = String(cleaned).trim().toLowerCase();
  if (normalized === 'all') return undefined;
  if (normalized === 'buy') return 'sale';
  return normalized;
}

/** Some clients send published instead of active. */
export function normalizeListingStatus({ value }: ValueParam): unknown {
  const cleaned = emptyToUndefined({ value });
  if (cleaned === undefined) return undefined;
  const normalized = String(cleaned).trim().toLowerCase();
  if (normalized === 'published') return 'active';
  return normalized;
}

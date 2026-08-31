const SYSTEM_KEY_FIELDS = [
  "id",
  "systemId",
  "code",
  "key",
  "name",
  "systemName",
  "label",
  "displayName",
] as const;

const SYSTEM_LABEL_FIELDS = [
  "name",
  "systemName",
  "label",
  "displayName",
  "id",
  "systemId",
  "code",
  "key",
] as const;

export interface NormalizedSystemRef {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface SystemNormalizationContext {
  activityId: string;
  sourceModelId: string;
}

function readStringField(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function pickFirstString(
  record: Record<string, unknown>,
  fields: readonly string[],
): string | undefined {
  for (const field of fields) {
    const value = readStringField(record[field]);
    if (value) return value;
  }
  return undefined;
}

export function stableSystemKey(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function makeSystemNodeId(key: string): string {
  return `System:${stableSystemKey(key)}`;
}

function normalizeStringSystem(system: string): NormalizedSystemRef | null {
  const label = readStringField(system);
  if (!label) return null;

  const key = stableSystemKey(label);
  return {
    id: makeSystemNodeId(key),
    label,
    properties: {
      name: label,
      raw: system,
      sourceFormat: "string",
    },
  };
}

function normalizeObjectSystem(
  system: Record<string, unknown>,
): NormalizedSystemRef | null {
  const systemKey = pickFirstString(system, SYSTEM_KEY_FIELDS);
  const systemLabel = pickFirstString(system, SYSTEM_LABEL_FIELDS);

  if (!systemKey && !systemLabel) {
    return null;
  }

  const key = stableSystemKey(systemKey ?? systemLabel!);
  const label = systemLabel ?? systemKey!;

  return {
    id: makeSystemNodeId(key),
    label,
    properties: {
      ...system,
      name: label,
      systemId: readStringField(system.id) ?? readStringField(system.systemId),
      sourceFormat: "object",
      raw: system,
    },
  };
}

export function normalizeSystemRef(
  system: unknown,
  _context: SystemNormalizationContext,
): NormalizedSystemRef | null {
  if (typeof system === "string") {
    return normalizeStringSystem(system);
  }

  if (system == null || typeof system !== "object" || Array.isArray(system)) {
    return null;
  }

  return normalizeObjectSystem(system as Record<string, unknown>);
}

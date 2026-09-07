import type { ParsedExtensionProperties } from "./types";

const KNOWN_EXTENSION_FIELDS = new Set([
  "description",
  "manualLink",
  "manualLinks",
  "systems",
  "fte",
  "futureStatus",
  "relatedProjects",
  "opexCost",
  "opexUnit",
  "opexNote",
  "dataAttachmentUrl",
  "dataAttachmentFile",
  "comments",
  "definitionId",
]);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function findPropertiesNode(
  extensionElements: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const properties =
    extensionElements.properties ?? extensionElements["uengine:properties"];
  return asRecord(properties);
}

function mapExtensionFields(
  parsed: Record<string, unknown>,
): ParsedExtensionProperties {
  const extension: ParsedExtensionProperties = {
    raw: parsed,
  };

  if (typeof parsed.description === "string") {
    extension.description = parsed.description;
  }
  if (typeof parsed.manualLink === "string") {
    extension.manualLink = parsed.manualLink;
  }
  if (Array.isArray(parsed.manualLinks)) {
    extension.manualLinks = parsed.manualLinks as ParsedExtensionProperties["manualLinks"];
  }
  if (Array.isArray(parsed.systems)) {
    extension.systems = parsed.systems as ParsedExtensionProperties["systems"];
  }
  if (parsed.fte != null && typeof parsed.fte === "object") {
    extension.fte = parsed.fte as ParsedExtensionProperties["fte"];
  }
  if (typeof parsed.futureStatus === "string") {
    extension.futureStatus = parsed.futureStatus;
  }
  if (Array.isArray(parsed.relatedProjects)) {
    extension.relatedProjects =
      parsed.relatedProjects as ParsedExtensionProperties["relatedProjects"];
  }
  if (parsed.opexCost === null || typeof parsed.opexCost === "number") {
    extension.opexCost = parsed.opexCost as number | null;
  }
  if (typeof parsed.opexUnit === "string") {
    extension.opexUnit = parsed.opexUnit;
  }
  if (typeof parsed.opexNote === "string") {
    extension.opexNote = parsed.opexNote;
  }
  if (typeof parsed.dataAttachmentUrl === "string") {
    extension.dataAttachmentUrl = parsed.dataAttachmentUrl;
  }
  if ("dataAttachmentFile" in parsed) {
    extension.dataAttachmentFile = parsed.dataAttachmentFile;
  }
  if (Array.isArray(parsed.comments)) {
    extension.comments = parsed.comments;
  }
  if (typeof parsed.definitionId === "string") {
    extension.definitionId = parsed.definitionId;
  }

  return extension;
}

// 이중 형식(R3) 폴백 (b): <property name value> 요소 + 관대 텍스트 키 매칭 대상 키
// (src/composables/ontology/bpmnOntologyParser.ts 의 readExtensionProps 로직 흡수)
const LENIENT_TEXT_KEYS = [
  "usesSystem",
  "uses_system",
  "hasManual",
  "has_manual",
  "confluenceUrl",
  "manualUrl",
  "lifecycle",
] as const;

function collectPropertyRecords(
  node: Record<string, unknown>,
  acc: Record<string, unknown>[],
): void {
  for (const [key, value] of Object.entries(node)) {
    const isPropertyKey = key === "property" || key.endsWith(":property");

    for (const item of Array.isArray(value) ? value : [value]) {
      const record = asRecord(item);
      if (!record) continue;
      if (isPropertyKey) acc.push(record);
      collectPropertyRecords(record, acc);
    }
  }
}

function collectTextValues(node: Record<string, unknown>, acc: string[]): void {
  for (const value of Object.values(node)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "string") {
        acc.push(item);
      } else {
        const record = asRecord(item);
        if (record) collectTextValues(record, acc);
      }
    }
  }
}

function coercePropertyValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const decoded = decodeHtmlEntities(value.trim());
  if (decoded.startsWith("{") || decoded.startsWith("[")) {
    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }
  return decoded;
}

// 형식 (b): 개별 <property name="..." value="..."/> 요소 + 관대 텍스트 키 매칭.
// 매칭된 값은 mapExtensionFields 를 거쳐 알려진 필드로, 미지 키는 raw 로 보존된다.
function extractPropertyFields(
  extensionElements: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const props: Record<string, unknown> = {};

  const propertyRecords: Record<string, unknown>[] = [];
  collectPropertyRecords(extensionElements, propertyRecords);

  for (const record of propertyRecords) {
    const name = record.name != null ? String(record.name) : undefined;
    const rawValue = record.value ?? record["#text"];
    if (!name || rawValue == null) continue;
    if (String(rawValue).trim() === "") continue;
    props[name] = coercePropertyValue(rawValue);
  }

  const textValues: string[] = [];
  collectTextValues(extensionElements, textValues);
  const text = textValues.join("\n");

  for (const key of LENIENT_TEXT_KEYS) {
    if (props[key] != null) continue;
    const match = new RegExp(
      `["']${key}["']\\s*:\\s*["']([^"']+)["']`,
    ).exec(text);
    if (match) props[key] = match[1];
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

export function parseExtensionProperties(
  element: Record<string, unknown>,
  context?: { file?: string; elementId?: string },
): {
  extension: ParsedExtensionProperties;
  warnings: string[];
} {
  const warnings: string[] = [];
  const extensionElements = asRecord(element.extensionElements);

  if (!extensionElements) {
    return { extension: {}, warnings };
  }

  // 형식 (b): 개별 property 요소·관대 텍스트 매칭 (형식 (a)가 있으면 (a)가 필드별로 우선)
  const propertyFields = extractPropertyFields(extensionElements);

  const propertiesNode = findPropertiesNode(extensionElements);
  const rawJson = propertiesNode?.json;
  const jsonText =
    rawJson == null
      ? undefined
      : typeof rawJson === "string"
        ? rawJson
        : String(rawJson);
  const trimmed = jsonText?.trim();

  if (trimmed != null && trimmed !== "" && trimmed !== "{}") {
    try {
      const decoded = decodeHtmlEntities(trimmed);
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      // 형식 (a) 결과가 필드별로 우선, (b)에만 있는 필드는 보충
      const merged = propertyFields ? { ...propertyFields, ...parsed } : parsed;
      return {
        extension: mapExtensionFields(merged),
        warnings,
      };
    } catch (error) {
      const elementId = context?.elementId ?? String(element.id ?? "unknown");
      const file = context?.file ?? "unknown";
      warnings.push(
        `[${file}] Failed to parse extension JSON for element ${elementId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        extension: propertyFields ? mapExtensionFields(propertyFields) : {},
        warnings,
      };
    }
  }

  if (propertyFields) {
    return { extension: mapExtensionFields(propertyFields), warnings };
  }

  return { extension: {}, warnings };
}

export function hasKnownExtensionField(
  field: string,
): field is keyof ParsedExtensionProperties {
  return KNOWN_EXTENSION_FIELDS.has(field);
}

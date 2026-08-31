/**
 * Graph build metadata shared by every graph source.
 *
 * Browser adaptation of the sample config/graphSource.ts: the CLI
 * config-file loading helpers (fs/path based) were removed; only the pure
 * metadata helpers remain. "local-folder" / "external-gitlab-repo" stay in
 * the union so sample CLI artifacts (graph.json) remain loadable as-is.
 */
export type GraphSourceType =
  | "supabase-proc-def"
  | "artifact-json"
  | "local-folder"
  | "external-gitlab-repo";

export interface GraphBuildMetadata {
  sourceId: string;
  sourceLabel: string;
  sourceType: GraphSourceType;
  inputPath?: string;
  manifestPath?: string;
  manifestFound?: boolean;
  manifestFileCount?: number;
  manifestUpdatedAt?: string;
  manifestSource?: string;
  generatedAt: string;
  fileCount: number;
  parsedFileCount: number;
  failedFileCount: number;
  limit?: number | null;
  pattern?: string | null;
  isSample?: boolean;
  /** supabase-proc-def 소스에서만 설정된다. */
  tenantId?: string;
}

export interface GraphBuildSourceOptions {
  sourceId: string;
  sourceLabel: string;
  sourceType: GraphSourceType;
  inputPath?: string;
  manifestPath?: string;
  limit?: number | null;
  pattern?: string | null;
  tenantId?: string;
}

export function buildGraphMetadata(
  options: GraphBuildSourceOptions,
  details: {
    fileCount: number;
    parsedFileCount: number;
    failedFileCount: number;
    manifestFound?: boolean;
    manifestFileCount?: number;
    manifestUpdatedAt?: string;
    manifestSource?: string;
    generatedAt?: string;
  },
): GraphBuildMetadata {
  return {
    sourceId: options.sourceId,
    sourceLabel: options.sourceLabel,
    sourceType: options.sourceType,
    inputPath: options.inputPath,
    manifestPath: options.manifestPath,
    manifestFound: details.manifestFound ?? false,
    manifestFileCount: details.manifestFileCount,
    manifestUpdatedAt: details.manifestUpdatedAt,
    manifestSource: details.manifestSource,
    generatedAt: details.generatedAt ?? new Date().toISOString(),
    fileCount: details.fileCount,
    parsedFileCount: details.parsedFileCount,
    failedFileCount: details.failedFileCount,
    limit: options.limit ?? null,
    pattern: options.pattern ?? null,
    // 샘플 파리티: limit이 주어진 빌드만 샘플 그래프로 표시
    isSample: options.limit != null && Number.isFinite(options.limit),
    tenantId: options.tenantId,
  };
}

export interface ManifestSummary {
  found: boolean;
  fileCount?: number;
  updatedAt?: string;
  source?: string;
}

export function summarizeManifest(raw: unknown): Pick<
  ManifestSummary,
  "fileCount" | "updatedAt" | "source"
> {
  if (!raw || typeof raw !== "object") return {};

  const record = raw as Record<string, unknown>;
  const summary: Pick<ManifestSummary, "fileCount" | "updatedAt" | "source"> = {};

  if (typeof record.fileCount === "number") {
    summary.fileCount = record.fileCount;
  } else if (Array.isArray(record.files)) {
    summary.fileCount = record.files.length;
  }

  if (typeof record.updatedAt === "string") {
    summary.updatedAt = record.updatedAt;
  }

  if (typeof record.source === "string") {
    summary.source = record.source;
  }

  return summary;
}

/**
 * ArtifactGraphSource — 샘플 CLI가 생성한 graph.json 아티팩트 로더.
 *
 * contracts/process-graph.contract.md §2.2:
 * - 입력: URL fetch 또는 파일 업로드(File/Blob 호환 — text()만 사용).
 * - 로드 후 클라이언트 재파생: addProcessRollupRelations(addInvokesSubprocessEdges(raw))
 *   (샘플 src/web/loadGraph.ts와 동일 — 파생 엣지는 아티팩트에 저장되지 않는다).
 * - 스키마 검증 실패(필수 키 누락) 시 명시적 오류. 실패 시 throw — 빈 그래프 대체 금지.
 */
import { buildGraphMetadata } from "../config/graphSource";
import { addInvokesSubprocessEdges } from "../graph/deriveSubprocessInvocation";
import { addProcessRollupRelations } from "../graph/rollupProcessRelations";
import type { ProcessGraph } from "../graph/types";
import type { GraphSourceProvider } from "./graphSource";

const REQUIRED_GRAPH_KEYS = ["nodes", "edges", "models", "parseReport"] as const;

/** File/Blob 최소 호환 인터페이스 — DOM lib 의존 없이 text()만 요구. */
export interface ArtifactFileLike {
  name?: string;
  text(): Promise<string>;
}

export interface ArtifactGraphSourceOptions {
  id?: string;
  label?: string;
  /** 샘플 CLI가 생성한 graph.json의 URL */
  url?: string;
  /** 업로드된 graph.json 파일 */
  file?: ArtifactFileLike;
}

export function validateArtifactGraph(raw: unknown): ProcessGraph {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Artifact graph must be a JSON object.");
  }

  const record = raw as Record<string, unknown>;
  const missing = REQUIRED_GRAPH_KEYS.filter((key) => record[key] == null);
  if (missing.length > 0) {
    throw new Error(
      `Artifact graph is missing required keys: ${missing.join(", ")}`,
    );
  }

  return raw as unknown as ProcessGraph;
}

export class ArtifactGraphSource implements GraphSourceProvider {
  readonly id: string;
  readonly label: string;
  readonly kind = "artifact" as const;

  private readonly url?: string;
  private readonly file?: ArtifactFileLike;

  constructor(options: ArtifactGraphSourceOptions) {
    if (!options.url && !options.file) {
      throw new Error("ArtifactGraphSource requires either a url or a file.");
    }

    this.url = options.url;
    this.file = options.file;
    this.id =
      options.id ??
      (options.url
        ? `artifact:${options.url}`
        : `artifact:${options.file?.name ?? "upload"}`);
    this.label =
      options.label ?? options.file?.name ?? options.url ?? "Artifact graph";
  }

  async load(): Promise<ProcessGraph> {
    const rawText = await this.readText();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      throw new Error(
        `Artifact graph JSON could not be parsed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const rawGraph = validateArtifactGraph(parsed);
    const graph = addProcessRollupRelations(addInvokesSubprocessEdges(rawGraph));

    // 아티팩트가 가진 metadata는 유지, 없을 때만 artifact-json 메타데이터 부여
    if (!graph.metadata) {
      graph.metadata = buildGraphMetadata(
        {
          sourceId: this.id,
          sourceLabel: this.label,
          sourceType: "artifact-json",
        },
        {
          fileCount:
            graph.parseReport.parsedFiles + graph.parseReport.failedFiles,
          parsedFileCount: graph.parseReport.parsedFiles,
          failedFileCount: graph.parseReport.failedFiles,
        },
      );
    }

    return graph;
  }

  private async readText(): Promise<string> {
    if (this.file) {
      return this.file.text();
    }

    const response = await fetch(this.url as string);
    if (!response.ok) {
      throw new Error(
        `Failed to load graph from ${this.url}: HTTP ${response.status}`,
      );
    }
    return response.text();
  }
}

import type { ProcessGraph } from "../graph/types";
import { rankEnrichmentRecommendations } from "./enrichmentRecommendations";
import { rankRedesignRecommendations } from "./redesignRecommendations";
import { rankOrganizationCoordinationCandidates } from "./organizationAnalysis";
import { rankStructuralBottleneckCandidates } from "./bottleneckAnalysis";
import { rankSystemBlastRadius } from "./impactAnalysis";
import { rankAutomationCandidates } from "./automationAnalysis";
import { rankCrossOrgHandoffHotspots } from "./crossOrgHandoffAnalysis";
import { rankReasoningReadiness } from "./readinessAnalysis";
import { rankModelingQualityIssues } from "./modelingQualityAnalysis";
import type { AnalysisReportOptions, InsightCard } from "./types";

/**
 * 리포트 스코프 문구 — graph.metadata 기반으로 생성한다.
 * (샘플의 FULL_CORPUS 고정 문구 "503 BPMN 파일"은 실제 소스와 무관하므로 제거.)
 */
function buildScopeNoteKo(graph: ProcessGraph): string {
  const metadata = graph.metadata;
  if (!metadata) return "현재 분석은 로드된 그래프 기준입니다.";

  const definitionCount = metadata.parsedFileCount ?? metadata.fileCount;

  if (metadata.isSample) {
    return `현재 분석은 샘플 그래프(${metadata.sourceLabel}, ${definitionCount}개 정의) 기준입니다 — 전체 코퍼스와 수치가 다를 수 있습니다.`;
  }

  return `현재 분석은 ${metadata.sourceLabel} (${definitionCount}개 프로세스 정의) 기준입니다.`;
}

export function generateInsightMarkdown(insight: InsightCard): string {
  if (insight.markdown.trim()) return insight.markdown;

  const lines = [`### ${insight.title}`, ""];

  if (insight.question) {
    lines.push(`**질문:** ${insight.question}`, "");
  }

  lines.push(`**결론:** ${insight.answer}`, "", `**해석:** ${insight.explanation}`);

  if (insight.reasons.length > 0) {
    lines.push("", "**근거:**");
    for (const reason of insight.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (insight.scoreBreakdown && insight.scoreBreakdown.length > 0) {
    lines.push("", "**점수 구성:**");
    for (const item of insight.scoreBreakdown) {
      if (item.points > 0) {
        lines.push(`- ${item.labelKo}: ${item.points.toFixed(1)} (${item.detail})`);
      }
    }
  }

  if (insight.metrics && Object.keys(insight.metrics).length > 0) {
    lines.push("", "**지표:**");
    for (const [key, value] of Object.entries(insight.metrics)) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  if (insight.evidence.summary) {
    lines.push("", `**근거 요약:** ${insight.evidence.summary}`);
  }

  const caveat =
    insight.category === "bottleneck"
      ? "구조적 병목 후보이며, 실행 데이터 없이 병목 여부를 확정할 수 없습니다."
      : insight.category === "impact"
        ? "모델링 기반 영향 후보이며, 실제 장애 영향을 단정하지 않습니다."
        : insight.category === "organization"
          ? "구조적 조율 병목 후보이며, 실제 업무 과부하나 지연을 확정하지 않습니다."
          : insight.category === "enrichment"
            ? "데이터 보강 추천은 추론 품질 개선을 위한 제안이며, 누락 필드가 항상 모델링 오류를 의미하지는 않습니다."
            : insight.category === "redesign"
              ? "재설계 추천은 PI/운영모델 검토 후보이며, 최종 결정이 아닙니다."
              : insight.category === "automation"
                ? "자동화 후보는 구조적 신호이며, 자동화를 확정하지 않습니다. 현업 검증이 필요합니다."
                : insight.category === "quality"
                  ? "품질·준비도 인사이트는 현재 모델 기준이며, 모델링 오류나 운영 병목을 단정하지 않습니다."
                  : "현재 로드된 그래프 모델링 품질에 따라 답변이 달라질 수 있습니다.";

  const nextAction =
    insight.category === "bottleneck"
      ? "도메인 담당자와 후보 근거를 검토하고 운영 데이터로 우선순위를 검증하세요."
      : insight.category === "impact"
        ? "상위 영향 후보 프로세스 담당자와 변경 영향도를 검토하세요."
        : insight.category === "organization"
          ? "조직 담당자와 관여 프로세스를 검토하고 운영 데이터로 조율 부담 여부를 검증하세요."
          : insight.category === "enrichment"
            ? "추천 데이터 소스 담당자와 연결 범위·우선순위를 검토하세요."
            : insight.category === "redesign"
              ? "프로세스 오너와 PI 관점에서 통합/분리/모듈화/R&R 검토 워크숍을 진행하세요."
              : insight.category === "automation"
                ? "반복 빈도, API 가능 여부, 예외율, 승인 필요 여부를 현업과 검토하세요."
                : insight.category === "quality"
                  ? "추천 메타데이터 보강 항목을 프로세스 오너와 우선순위를 정해 반영하세요."
                  : "담당 프로세스 오너에게 결과를 공유하고 모델링 누락 여부를 확인하세요.";

  lines.push("", "**주의:**", caveat, "", "**권장 후속 조치:**", nextAction);

  return lines.join("\n");
}

function countNodesByType(graph: ProcessGraph, type: string): number {
  return graph.nodes.filter((n) => n.type === type).length;
}

export function generateAnalysisReportMarkdown(
  graph: ProcessGraph,
  options?: AnalysisReportOptions,
): string {
  const title = options?.title ?? "BPMN Process Knowledge Graph Analysis Report";
  const topBottlenecks = options?.topBottlenecks ?? 5;
  const topSystems = options?.topSystems ?? 5;
  const topOrganizations = options?.topOrganizations ?? 10;
  const topEnrichmentRecommendations = options?.topEnrichmentRecommendations ?? 10;
  const topRedesignRecommendations = options?.topRedesignRecommendations ?? 10;
  const topAutomationCandidates = options?.topAutomationCandidates ?? 10;
  const topCrossOrgHandoffHotspots = options?.topCrossOrgHandoffHotspots ?? 10;
  const topReasoningReadiness = options?.topReasoningReadiness ?? 10;
  const topModelingQualityIssues = options?.topModelingQualityIssues ?? 10;
  const includeCaveats = options?.includeCaveats ?? true;
  const scopeNoteKo = buildScopeNoteKo(graph);

  const bottlenecks = rankStructuralBottleneckCandidates(
    graph,
    { limit: topBottlenecks },
    options?.graphIndex,
  );
  const systems = rankSystemBlastRadius(
    graph,
    { limit: topSystems },
    options?.graphIndex,
  );
  const organizations = rankOrganizationCoordinationCandidates(
    graph,
    { limit: topOrganizations },
    options?.graphIndex,
  );
  const enrichments = rankEnrichmentRecommendations(
    graph,
    { limit: topEnrichmentRecommendations },
    options?.graphIndex,
    {
      bottleneckInsights: bottlenecks,
      organizationInsights: organizations,
      systemImpactInsights: systems,
    },
  );
  const redesigns = rankRedesignRecommendations(
    graph,
    { limit: topRedesignRecommendations },
    options?.graphIndex,
  );
  const automationCandidates = rankAutomationCandidates(
    graph,
    { limit: topAutomationCandidates },
    options?.graphIndex,
  );
  const handoffHotspots = rankCrossOrgHandoffHotspots(
    graph,
    { limit: topCrossOrgHandoffHotspots },
    options?.graphIndex,
  );
  const readinessInsights = rankReasoningReadiness(
    graph,
    { limit: topReasoningReadiness },
    options?.graphIndex,
  );
  const modelingQualityInsights = rankModelingQualityIssues(
    graph,
    { limit: topModelingQualityIssues },
    options?.graphIndex,
  );

  const lines = [`# ${title}`, ""];

  lines.push(`> ${scopeNoteKo}`, "");

  lines.push(
    "## 1. Summary",
    "",
    `- Models: ${countNodesByType(graph, "ProcessModel")}`,
    `- Processes: ${countNodesByType(graph, "Process")}`,
    `- Activities: ${countNodesByType(graph, "ProcessActivity")}`,
    `- Systems: ${countNodesByType(graph, "System")}`,
    `- Organizations: ${countNodesByType(graph, "Organization")}`,
    `- Suppliers: ${countNodesByType(graph, "Supplier")}`,
    `- DataStores: ${countNodesByType(graph, "DataStore")}`,
    `- DataObjects: ${countNodesByType(graph, "DataObject")}`,
    "",
    "## 2. Top Structural Bottleneck Candidates",
    "",
  );

  if (bottlenecks.length === 0) {
    lines.push("(no process bottleneck candidates)");
  } else {
    for (const insight of bottlenecks) {
      lines.push(generateInsightMarkdown(insight), "");
    }
  }

  lines.push("## 3. Top System Blast Radius", "");

  if (systems.length === 0) {
    lines.push("(no system impact insights)");
  } else {
    for (const insight of systems) {
      lines.push(generateInsightMarkdown(insight), "");
    }
  }

  lines.push("## 4. Top Organization Coordination Candidates", "");

  if (organizations.length === 0) {
    lines.push("(no organization coordination insights)");
  } else {
    for (const insight of organizations) {
      lines.push(generateInsightMarkdown(insight), "");
    }
  }

  if (includeCaveats) {
    lines.push("## 5. Top Enrichment Recommendations", "");

    if (enrichments.length === 0) {
      lines.push("(no enrichment recommendations)");
    } else {
      for (const insight of enrichments) {
        lines.push(generateInsightMarkdown(insight), "");
      }
    }

    lines.push("## 6. Top Process Redesign Recommendations", "");

    if (redesigns.length === 0) {
      lines.push("(no redesign recommendations)");
    } else {
      const sequenceCandidates = redesigns.filter(
        (insight) => insight.metrics?.["추천 유형"] === "공통 Task Sequence",
      );
      const otherRedesigns = redesigns.filter(
        (insight) => insight.metrics?.["추천 유형"] !== "공통 Task Sequence",
      );

      for (const insight of otherRedesigns) {
        lines.push(generateInsightMarkdown(insight), "");
      }

      lines.push("### Common Task Sequence / Process Module Candidates", "");

      if (sequenceCandidates.length === 0) {
        lines.push("(no common task sequence candidates)", "");
      } else {
        for (const insight of sequenceCandidates) {
          lines.push(generateInsightMarkdown(insight), "");
        }
      }
    }

    lines.push("## 7. Top Automation Candidates", "");

    if (automationCandidates.length === 0) {
      lines.push("(no automation candidates)");
    } else {
      for (const insight of automationCandidates) {
        lines.push(generateInsightMarkdown(insight), "");
      }
    }

    lines.push("## 8. Top Cross-org Handoff Hotspots", "");

    if (handoffHotspots.length === 0) {
      lines.push("(no cross-org handoff hotspots)");
    } else {
      for (const insight of handoffHotspots) {
        lines.push(generateInsightMarkdown(insight), "");
      }
    }

    lines.push("## 9. Reasoning Readiness Summary", "");

    if (readinessInsights.length === 0) {
      lines.push("(no reasoning readiness insights)");
    } else {
      for (const insight of readinessInsights) {
        lines.push(generateInsightMarkdown(insight), "");
      }
    }

    lines.push("## 10. Modeling Quality Improvement Candidates", "");

    if (modelingQualityInsights.length === 0) {
      lines.push("(no modeling quality insights)");
    } else {
      for (const insight of modelingQualityInsights) {
        lines.push(generateInsightMarkdown(insight), "");
      }
    }

    lines.push(
      "## 11. Data Quality / Modeling Caveats",
      "",
      "- This is structural analysis, not runtime bottleneck proof.",
      "- Organization coordination insights are structural coordination candidates, not workload proof.",
      "- Enrichment recommendations identify useful data to connect next. They do not imply that missing fields are modeling errors in every case.",
      "- Redesign recommendations are PI/operating model review candidates, not automatic decisions.",
      "- Automation candidates are structural signals; automation type and scope require domain validation.",
      "- Cross-org handoff hotspots are interface review candidates, not confirmed organizational bottlenecks.",
      "- Reasoning readiness and modeling quality scores reflect current metadata, not runtime proof.",
      "- Task sequence mining is deterministic (label/action dictionary); LLM semantic matching is deferred.",
      "- Results depend on BPMN modeling quality.",
      "- Annotation fields are not used as primary evidence because they are free-form memo fields.",
      `- ${scopeNoteKo}`,
      "",
      "## 12. Next Recommended Analysis",
      "",
      "- Connect runtime logs, ticket volume, SLA, incident history, and work volume data.",
      "- Validate top structural bottleneck candidates with domain owners.",
      "- Normalize duplicated system names and organization names.",
    );
  }

  return lines.join("\n");
}

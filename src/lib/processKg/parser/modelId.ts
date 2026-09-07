// 브라우저 안전: node:path 대신 "/" 기준 순수 문자열 연산 사용
function basenameOf(filePath: string): string {
  const trimmed = filePath.replace(/\/+$/, "");
  const separatorIndex = trimmed.lastIndexOf("/");
  return separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
}

export function deriveModelIdFromPath(filePath: string): string {
  const fileName = basenameOf(filePath);
  const bracketIndex = fileName.indexOf("_[");

  if (bracketIndex > 0) {
    return `${fileName.substring(0, bracketIndex)}.bpmn`;
  }

  const underscoreIndex = fileName.indexOf("_");
  if (underscoreIndex > 0) {
    return `${fileName.substring(0, underscoreIndex)}.bpmn`;
  }

  return fileName;
}

const PROCESS_CODE_REGEX = /\[([^\]]+)\]/;

export function extractProcessCode(value?: string): string | undefined {
  if (!value) return undefined;
  const match = PROCESS_CODE_REGEX.exec(value);
  return match?.[1];
}

function basenameWithoutExtension(filePath: string): string {
  const fileName = basenameOf(filePath);
  return fileName.replace(/\.bpmn$/i, "");
}

export function deriveDisplayNameFromSourceFile(sourceFile: string): string {
  const basename = basenameWithoutExtension(sourceFile);

  const bracketIndex = basename.indexOf("[");
  if (bracketIndex >= 0) {
    return basename.substring(bracketIndex).trim();
  }

  if (
    basename.startsWith("ca--") ||
    basename.startsWith("ca-ip-") ||
    basename.startsWith("ai-")
  ) {
    const underscoreIndex = basename.indexOf("_");
    if (underscoreIndex >= 0) {
      return basename.substring(underscoreIndex + 1).trim();
    }
  }

  const underscoreIndex = basename.indexOf("_");
  if (underscoreIndex >= 0) {
    return basename.substring(underscoreIndex + 1).trim();
  }

  return basename.trim();
}

export function deriveDisplayNameFromPath(filePath: string): string {
  return deriveDisplayNameFromSourceFile(basenameOf(filePath));
}

const GENERIC_PROCESS_NAMES = new Set([
  "Proc_SKT",
  "Process_SKT",
  "Process_ProcessLifecycle",
  "Process_TelecomMonitoring",
]);

export function isGenericProcessName(value?: string): boolean {
  if (!value) return true;
  if (GENERIC_PROCESS_NAMES.has(value)) return true;
  if (value.startsWith("Process_")) return true;
  if (value.startsWith("Proc_")) return true;
  return false;
}

export function resolveProcessDisplayLabel(
  displayName: string,
  processName?: string,
  processId?: string,
): string {
  if (displayName.trim()) return displayName;
  if (processName && !isGenericProcessName(processName)) return processName;
  if (processId && !isGenericProcessName(processId)) return processId;
  return processName ?? processId ?? displayName;
}

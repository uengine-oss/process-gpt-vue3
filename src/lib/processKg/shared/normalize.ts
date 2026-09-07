export function normalizeActivityKind(bpmnType: string): string {
  switch (bpmnType) {
    case "manualTask":
      return "manual_work";
    case "userTask":
      return "system_user_work";
    case "sendTask":
      return "communication_send";
    case "receiveTask":
      return "communication_receive";
    case "serviceTask":
      return "system_automated_work";
    case "callActivity":
      return "process_call";
    case "task":
      return "generic_activity";
    default:
      return "generic_activity";
  }
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

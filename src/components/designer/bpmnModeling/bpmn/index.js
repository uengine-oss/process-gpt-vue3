const modules = import.meta.glob("@/components/designer/bpmnModeling/bpmn/**/*.vue", { eager: true });

const registeredComponents = new Set();

export default function loadBpmnComponents(app) {
  const bpmnComponents = {}
  for (const path in modules) {
    // copy 파일 제외
    if (path.includes(' copy') || path.includes('copy.vue')) {
      continue;
    }

    const componentName = path.split("/").at(-1).split(".")[0];
    const componentDef = modules[path].default;
    const registrationName = componentDef?.name;

    // name이 없거나 이미 등록된 컴포넌트는 건너뛰기
    if (!registrationName || registeredComponents.has(registrationName)) {
      continue;
    }

    app.component(registrationName, componentDef);
    registeredComponents.add(registrationName);
    bpmnComponents[componentName] = modules[path];
  }
  window.bpmnComponents = bpmnComponents
}
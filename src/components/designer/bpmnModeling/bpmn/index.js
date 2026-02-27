const modules = import.meta.glob("@/components/designer/bpmnModeling/bpmn/**/*.vue", { eager: true });

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

    // name이 없으면 건너뛰기
    if (!registrationName) {
      continue;
    }

    // Vue 앱에 이미 등록된 컴포넌트인지 확인
    if (app._context?.components?.[registrationName]) {
      continue;
    }

    app.component(registrationName, componentDef);
    bpmnComponents[componentName] = modules[path];
  }
  window.bpmnComponents = bpmnComponents
}
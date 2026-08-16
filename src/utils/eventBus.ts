import mitt from 'mitt';

// main.ts 의 app.config.globalProperties.EventBus 와 동일한 인스턴스.
// Vue 컴포넌트 밖(ProcessGPTBackend 등)에서도 같은 버스에 emit/on 할 수 있도록 공용 모듈로 분리.
export const EventBus = mitt();

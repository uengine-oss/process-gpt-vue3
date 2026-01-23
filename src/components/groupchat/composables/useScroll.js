import { ref, nextTick } from 'vue';

export function useScroll() {
  const scrollContainer = ref(null);
  const isAtBottom = ref(true);
  const previewMessage = ref(null);

  function resolveContainer() {
    const refVal = scrollContainer.value;
    if (!refVal) return null;
    // perfect-scrollbar 컴포넌트(ref) 또는 DOM 엘리먼트(ref.value) 모두 대응
    return refVal.$el || refVal.value || refVal;
  }

  // 스크롤 이벤트 핸들러
  function handleScroll() {
    const container = resolveContainer();
    if (!container) return;
    const target =
      (container && container.querySelector && (container.querySelector('.ps-content') || container.querySelector('.ps'))) ||
      container;
    const { scrollTop, scrollHeight, clientHeight } = target || {};
    
    // 하단에서 100px 이내면 하단으로 간주
    isAtBottom.value = scrollHeight - scrollTop - clientHeight < 100;

    if (isAtBottom.value) {
      previewMessage.value = null;
    }
  }

  // 최상단으로 스크롤
  function scrollToTop() {
    const container = resolveContainer();
    if (container) {
      container.scrollTop = 0;
    }
  }

  // 최하단으로 스크롤
  function scrollToBottom() {
    nextTick(() => {
      const container = resolveContainer();
      if (!container) return;
      let target = container;
      if (container && container.querySelector) {
        target = container.querySelector('.ps-content') || container.querySelector('.ps') || container.firstElementChild || container;
      }
      if (target && typeof target.scrollTop !== 'undefined') {
        target.scrollTop = target.scrollHeight;
      }
      isAtBottom.value = true;
      previewMessage.value = null;
    });
  }

  // 스크롤 컨테이너 업데이트
  function updateScroll() {
    const refVal = scrollContainer.value;
    const updater = refVal?.update || refVal?.value?.update;
    if (typeof updater === 'function') updater();
  }

  return {
    scrollContainer,
    isAtBottom,
    previewMessage,
    handleScroll,
    scrollToTop,
    scrollToBottom,
    updateScroll
  };
}
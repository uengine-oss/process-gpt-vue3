import { ref, nextTick } from 'vue';

export function useScroll() {
  const scrollContainer = ref(null);
  const isAtBottom = ref(true);
  const previewMessage = ref(null);

  // 스크롤 이벤트 핸들러
  function handleScroll() {
    if (!scrollContainer.value) return;

    const container = scrollContainer.value.$el || scrollContainer.value;
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // 하단에서 100px 이내면 하단으로 간주
    isAtBottom.value = scrollHeight - scrollTop - clientHeight < 100;

    if (isAtBottom.value) {
      previewMessage.value = null;
    }
  }

  // 최상단으로 스크롤
  function scrollToTop() {
    if (scrollContainer.value) {
      const container = scrollContainer.value.$el || scrollContainer.value;
      container.scrollTop = 0;
    }
  }

  // 최하단으로 스크롤
  function scrollToBottom() {
    nextTick(() => {
      if (scrollContainer.value) {
        const container = scrollContainer.value.$el || scrollContainer.value;
        container.scrollTop = container.scrollHeight;
        isAtBottom.value = true;
        previewMessage.value = null;
      }
    });
  }

  // 스크롤 컨테이너 업데이트
  function updateScroll() {
    if (scrollContainer.value && scrollContainer.value.update) {
      scrollContainer.value.update();
    }
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
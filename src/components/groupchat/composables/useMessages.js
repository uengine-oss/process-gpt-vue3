import { computed } from 'vue';
import { marked } from 'marked';

export function useMessages(messages, userInfo) {
  // 마크다운 설정
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  // 필터링된 메시지 목록
  const filteredMessages = computed(() => {
    const list = [];
    const myEmail = localStorage.getItem('email');

    if (messages.value && messages.value.length > 0) {
      messages.value.forEach((item) => {
        const data = JSON.parse(JSON.stringify(item));

        // 프로세스 실행 메시지에 formValues 초기화
        if (data.work === 'StartProcessInstance' && data.firstActivityForm && !data.formValues) {
          data.formValues = {};
        }

        // 에이전트 개입 응답 메시지는 필터링에서 제외
        if (shouldHideAgentInterventionResponse(data)) {
          return;
        }

        if (data.content || data.jsonContent || data.image || (data.jsonContent && data.jsonContent.intervention)) {
          list.push(data);
        }
      });
    }

    return list;
  });

  // 내 메시지 목록 (최신순)
  const myMessages = computed(() => {
    if (!messages.value || messages.value.length === 0) return [];
    return messages.value
      .filter((message) => message.email === userInfo.value?.email && message.content && message.content.trim() !== '')
      .reverse();
  });

  // 에이전트 개입 응답 메시지 숨김 여부
  function shouldHideAgentInterventionResponse(message) {
    if (!message || (message.role !== 'system' && message.role !== 'agent')) {
      return false;
    }

    let jsonContent = message.jsonContent;
    if (typeof jsonContent === 'string') {
      try {
        jsonContent = JSON.parse(jsonContent);
      } catch (e) {
        jsonContent = null;
      }
    }

    return jsonContent && (jsonContent.user_message_id || jsonContent.user_message_uuid);
  }

  // 시간 포맷팅
  function formatTime(timeStamp) {
    const date = new Date(timeStamp);
    const dateString = date.toString();
    const timeString = dateString.split(' ')[4].substring(0, 5);
    return timeString;
  }

  // 날짜 구분선 표시 여부
  function shouldDisplayDateSeparator(message, index, messages, t) {
    if (!message.timeStamp) return false;

    if (index === 0) {
      const currentDate = new Date(message.timeStamp);
      const today = new Date();

      if (currentDate.toDateString() === today.toDateString()) {
        const hasOlderMessages = messages.some((msg, idx) => {
          if (!msg.timeStamp || idx === 0) return false;
          const msgDate = new Date(msg.timeStamp);
          return msgDate.toDateString() !== today.toDateString();
        });
        return hasOlderMessages;
      }
      return true;
    }

    if (index > 0) {
      const prevMessage = messages[index - 1];
      const currentDate = new Date(message.timeStamp);
      const prevDate = new Date(prevMessage.timeStamp);

      return (
        currentDate.getFullYear() !== prevDate.getFullYear() ||
        currentDate.getMonth() !== prevDate.getMonth() ||
        currentDate.getDate() !== prevDate.getDate()
      );
    }
    return false;
  }

  // 날짜 구분선 포맷팅
  function formatDateSeparator(timeStamp, t) {
    const date = new Date(timeStamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = t(`chats.${dayKeys[date.getDay()]}`);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('chats.today');
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return t('chats.yesterday');
    }

    if (date.getFullYear() === today.getFullYear()) {
      return t('chats.thisYear', { month, day, dayName });
    }

    return t('chats.otherYear', { year, month, day, dayName });
  }

  // 유저 정보 표시 여부
  function shouldDisplayUserInfo(message, index, messages) {
    if (index === 0) return true;

    const prevMessage = messages[index - 1];

    if (message.email !== prevMessage.email) return true;

    const currentTime = new Date(message.timeStamp);
    const prevTime = new Date(prevMessage.timeStamp);

    if (
      currentTime.getFullYear() !== prevTime.getFullYear() ||
      currentTime.getMonth() !== prevTime.getMonth() ||
      currentTime.getDate() !== prevTime.getDate() ||
      currentTime.getHours() !== prevTime.getHours() ||
      currentTime.getMinutes() !== prevTime.getMinutes()
    ) {
      return true;
    }

    return false;
  }

  // 타임스탬프 표시 여부
  function shouldDisplayMessageTimestamp(message, index, messages) {
    const prevMessage = messages[index - 1];

    if (prevMessage && message.email !== prevMessage.email) return true;

    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

    if (!nextMessage || message.email !== nextMessage.email) return true;

    const currentTime = new Date(message.timeStamp);
    const nextTime = new Date(nextMessage.timeStamp);

    if (
      currentTime.getFullYear() !== nextTime.getFullYear() ||
      currentTime.getMonth() !== nextTime.getMonth() ||
      currentTime.getDate() !== nextTime.getDate() ||
      currentTime.getHours() !== nextTime.getHours() ||
      currentTime.getMinutes() !== nextTime.getMinutes()
    ) {
      return true;
    }

    return false;
  }

  // 마크다운 렌더링
  function renderedMarkdown(text, isGenerating = false) {
    if (!text) return '';

    const trimmedText = text.trim();

    if (trimmedText === 'AI 생성중...') {
      return createThinkingAnimation('AI 생성 중...');
    }

    const isLoadingPlaceholder = trimmedText === '...' || trimmedText === '….';

    let processedText = text;
    let hasJsonBlock = false;

    if (!isLoadingPlaceholder && (text.includes('processDefinitionId') || text.includes('elements'))) {
      const codeBlockStart = text.indexOf('```');
      if (codeBlockStart !== -1) {
        hasJsonBlock = true;
        processedText = text.substring(0, codeBlockStart).trim();
      }
    }

    let renderedHtml = isLoadingPlaceholder ? '' : marked(processedText);

    if ((hasJsonBlock && isGenerating) || isLoadingPlaceholder) {
      renderedHtml += createThinkingAnimation('AI 생성 중...', hasJsonBlock);
    }

    return renderedHtml;
  }

  // 로딩 애니메이션 생성
  function createThinkingAnimation(text, hasMarginTop = false) {
    const animatedChars = text
      .split('')
      .map((char, index) => {
        const safeChar = char === ' ' ? '&nbsp;' : char;
        return `<span class="thinking-char" style="animation-delay: ${index * 0.1}s">${safeChar}</span>`;
      })
      .join('');

    const marginTop = hasMarginTop ? 'margin-top: 16px;' : '';
    return `<div class="thinking-wave-text" style="${marginTop} font-weight: bold;">${animatedChars}</div>`;
  }

  // URL을 링크로 변환
  function linkify(inputText) {
    if (!inputText) return '';

    let replacedText = inputText;

    // http://, https://, ftp:// 로 시작하는 URL
    const replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    replacedText = replacedText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

    // www. 로 시작하는 URL
    const replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
    replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

    // 이메일 주소
    const replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
    replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

    return replacedText;
  }

  // 멘션이 포함된 텍스트 링크 변환
  function linkifyWithMentions(inputText, userList, participantUsers) {
    if (!inputText) return '';

    let text = inputText;
    const allUsers = [];

    if (userList) {
      allUsers.push(...userList);
    }

    if (participantUsers) {
      participantUsers.forEach((participant) => {
        if (participant.is_agent && !allUsers.find((u) => u.id === participant.id)) {
          allUsers.push(participant);
        }
      });
    }

    allUsers.push({
      email: 'system@uengine.org',
      id: 'system_id',
      username: 'System'
    });

    allUsers.forEach((user) => {
      if (user.username) {
        const mentionPattern = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
        const mentionHtml = `<span class="mention-highlight" style="color: #1976d2; font-weight: 600; background-color: rgba(25, 118, 210, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.95em;">@${user.username}</span>`;
        text = text.replace(mentionPattern, mentionHtml);
      }
    });

    return linkify(text);
  }

  // messageForUser 추출
  function setMessageForUser(content) {
    if (content && typeof content === 'string') {
      if (content.includes(`"messageForUser":`)) {
        try {
          const contentObj = JSON.parse(content);
          return linkify(contentObj.messageForUser || content);
        } catch {
          return linkify(content);
        }
      }
      return linkify(content);
    }
    return '';
  }

  return {
    filteredMessages,
    myMessages,
    shouldHideAgentInterventionResponse,
    formatTime,
    shouldDisplayDateSeparator,
    formatDateSeparator,
    shouldDisplayUserInfo,
    shouldDisplayMessageTimestamp,
    renderedMarkdown,
    linkify,
    linkifyWithMentions,
    setMessageForUser
  };
}
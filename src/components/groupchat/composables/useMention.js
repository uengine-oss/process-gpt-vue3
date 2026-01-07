import { ref, computed } from 'vue';
import { useDefaultSetting } from '@/stores/defaultSetting';

export function useMention(userList, currentChatRoom, participantUsers) {
  const newMessage = ref('');
  const mentionedUsers = ref([]);
  const showUserList = ref(false);
  const mentionStartIndex = ref(null);
  const selectedUserIndex = ref(-1);

  // 필터링된 사용자 목록
  const filteredUserList = computed(() => {
    if (!showUserList.value || mentionStartIndex.value === null || !userList.value) {
      return [];
    }

    let users = userList.value.filter((user) =>
      currentChatRoom.value?.participants?.some((participant) => participant.id === user.id)
    );

    const defaultSetting = useDefaultSetting();
    const agentList = defaultSetting.getAgentList;

    if (participantUsers.value && participantUsers.value.length > 0) {
      agentList.forEach((agent) => {
        if (agent.is_hidden) return;

        const existsInUserList = users.some((u) => u.id === agent.id);
        const isParticipant = participantUsers.value.some((participant) => {
          if (participant.id === agent.id) return true;
          if (participant.is_agent && participant.agent_type === agent.agent_type && participant.alias === agent.alias) return true;
          if (participant.email && agent.email && participant.email === agent.email) return true;
          return false;
        });

        if (!existsInUserList && isParticipant) {
          users.push({
            id: agent.id,
            username: agent.username,
            email: agent.email || `${agent.alias}@agent`,
            profile: agent.profile || '/images/chat-icon.png',
            is_agent: true,
            agent_type: agent.agent_type,
            alias: agent.alias
          });
        }
      });
    }

    users.push({
      email: 'system@uengine.org',
      id: 'system_id',
      profile: '/images/chat-icon.png',
      username: 'System'
    });

    users.reverse();

    const query = newMessage.value.substring(mentionStartIndex.value + 1).toLowerCase();
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(query) &&
        !mentionedUsers.value.some((mentionedUser) => mentionedUser.id === user.id)
    );
  });

  // 시스템 멘션 여부
  const isSystemMentioned = computed(() => {
    return (
      mentionedUsers.value.some((user) => user.id === 'system_id') ||
      newMessage.value.startsWith('>') ||
      newMessage.value.startsWith('!')
    );
  });

  // 멘션된 에이전트 찾기
  const mentionedAgent = computed(() => {
    return mentionedUsers.value.find((user) => user.is_agent);
  });

  // 텍스트 입력 핸들러
  function handleTextareaInput(event) {
    const text = event.target.value;

    const atIndex = text.lastIndexOf('@');
    if (atIndex !== -1) {
      const afterAt = text.substring(atIndex + 1);
      const hasSpace = afterAt.includes(' ');

      const isCompleteMention = mentionedUsers.value.some((user) => {
        const mentionText = `@${user.username}`;
        return text.substring(atIndex).startsWith(mentionText + ' ') || text.substring(atIndex).startsWith(mentionText);
      });

      if (!hasSpace && !isCompleteMention) {
        showUserList.value = true;
        mentionStartIndex.value = atIndex;
        selectedUserIndex.value = -1;
      } else {
        showUserList.value = false;
        selectedUserIndex.value = -1;
      }
    } else {
      showUserList.value = false;
      selectedUserIndex.value = -1;
    }
  }

  // 사용자 선택
  function selectUser(user) {
    const beforeMention = newMessage.value.substring(0, mentionStartIndex.value);
    const afterMention = newMessage.value.substring(mentionStartIndex.value);
    const spaceIndex = afterMention.indexOf(' ');

    if (spaceIndex !== -1) {
      newMessage.value = beforeMention + afterMention.substring(spaceIndex + 1);
    } else {
      newMessage.value = beforeMention;
    }

    showUserList.value = false;
    selectedUserIndex.value = -1;

    if (!mentionedUsers.value.some((mentionedUser) => mentionedUser.id === user.id)) {
      mentionedUsers.value.push(user);
    }
  }

  // 멘션 제거
  function removeMention(userId) {
    mentionedUsers.value = mentionedUsers.value.filter((u) => u.id !== userId);
  }

  // 키보드 네비게이션
  function handleKeydown(event) {
    if (!showUserList.value || filteredUserList.value.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedUserIndex.value = (selectedUserIndex.value + 1) % filteredUserList.value.length;
        scrollToSelectedUser();
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (selectedUserIndex.value <= 0) {
          selectedUserIndex.value = filteredUserList.value.length - 1;
        } else {
          selectedUserIndex.value--;
        }
        scrollToSelectedUser();
        break;
      case 'Enter':
        if (selectedUserIndex.value >= 0 && selectedUserIndex.value < filteredUserList.value.length) {
          event.preventDefault();
          selectUser(filteredUserList.value[selectedUserIndex.value]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        showUserList.value = false;
        selectedUserIndex.value = -1;
        break;
    }
  }

  // 선택된 사용자로 스크롤
  function scrollToSelectedUser() {
    const userListElement = document.querySelector('.user-list');
    if (userListElement) {
      const selectedElement = userListElement.children[selectedUserIndex.value];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  // 메시지에 멘션 텍스트 추가
  function getMessageWithMentions() {
    if (mentionedUsers.value.length > 0) {
      const mentionText = mentionedUsers.value.map((user) => `@${user.username}`).join(' ');
      return mentionText + (newMessage.value ? ' ' + newMessage.value : '');
    }
    return newMessage.value;
  }

  // 초기화
  function resetMention() {
    newMessage.value = '';
    mentionedUsers.value = [];
    showUserList.value = false;
    selectedUserIndex.value = -1;
  }

  return {
    newMessage,
    mentionedUsers,
    showUserList,
    mentionStartIndex,
    selectedUserIndex,
    filteredUserList,
    isSystemMentioned,
    mentionedAgent,
    handleTextareaInput,
    selectUser,
    removeMention,
    handleKeydown,
    getMessageWithMentions,
    resetMention
  };
}
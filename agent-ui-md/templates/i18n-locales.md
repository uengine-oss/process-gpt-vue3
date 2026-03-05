# 국가별 언어 정의 (i18n)

## 파일 경로

```
src/utils/locales/
├── ko.json       # 한국어
├── en.json       # 영어
└── messages.ts   # 통합
```

---

## 기본 구조

```json
{
  "파일명": {
    "key": "value"
  }
}
```

---

## 작성 예시

```json
{
  "taskCatalog": {
    "title": "작업 카탈로그",
    "enabled": "활성",
    "disabled": "비활성",
    "taskTypesHelp": {
      "detail1": "팔레트에 표시할 작업 유형을 설정합니다."
    }
  }
}
```

---

## 사용법

### 템플릿

```vue
<!-- 기본 -->
{{ $t('taskCatalog.title') }}

<!-- 변수 포함 -->
{{ $t('InstanceCard.sendEvent', { event: event }) }}
```

### script setup

```javascript
import { getCurrentInstance } from 'vue'

const { proxy } = getCurrentInstance()

// 기본
proxy.$t('taskCatalog.title')

// 변수 포함
proxy.$t('InstanceCard.sendEvent', { event: event })
```

### 일반 script (Options API)

```javascript
// 기본
this.$t('taskCatalog.title')

// 변수 포함
this.$t('chats.requestCancelled', { name: this.name })
```

---

## 변수 포함 예시

```json
// ko.json
"sendEvent": "{event} 보내기"

// en.json
"sendEvent": "Send {event}"
```

- 왼쪽 `{event}` → JSON의 변수명
- 오른쪽 `event` → 전달할 실제 값

---

## 키 네이밍

| 유형 | 패턴 | 예시 |
|------|------|------|
| 제목 | `{기능}.title` | `taskCatalog.title` |
| 버튼 | `{기능}.{동작}` | `taskCatalog.save` |
| 에러 | `{기능}.{동작}Failed` | `taskCatalog.saveFailed` |
| 도움말 | `{기능}.{항목}Help.detail{N}` | `taskCatalog.taskTypesHelp.detail1` |

---

## 번역 원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| 직역 금지 | 영어 표현을 그대로 번역하지 않음 | ❌ "Task가 시작된" → ✅ "작업이 시작된" |
| 전문 용어 유지 | FTE, BPMN, 인스턴스 등 업계 표준 용어는 유지 | ✅ "FTE 설정", ✅ "인스턴스" |
| 영어 혼용 제거 | 설명 문장에서 불필요한 영어 제거 | ❌ "Idle Time(대기)" → ✅ "대기 시간" |

---

## 주의

- ko.json과 en.json 키 동기화 필수
- 기본 언어는 ko
- 번역 시 사용자 친화적 표현 우선

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

```vue
<!-- 템플릿 -->
{{ $t('taskCatalog.title') }}

<!-- 변수 포함 -->
{{ $t('message.greeting', { name: userName }) }}
```

```javascript
// Script
this.$t('taskCatalog.title')
```

---

## 키 네이밍

| 유형 | 패턴 | 예시 |
|------|------|------|
| 제목 | `{기능}.title` | `taskCatalog.title` |
| 버튼 | `{기능}.{동작}` | `taskCatalog.save` |
| 에러 | `{기능}.{동작}Failed` | `taskCatalog.saveFailed` |
| 도움말 | `{기능}.{항목}Help.detail{N}` | `taskCatalog.taskTypesHelp.detail1` |

---

## 주의

- ko.json과 en.json 키 동기화 필수
- 기본 언어는 ko

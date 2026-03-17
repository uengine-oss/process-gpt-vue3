# DetailComponent 활용법

도움말 아이콘 버튼. 호버 시 상세 설명 팝업 표시.

## 경로

```
@/components/ui-components/details/DetailComponent.vue
```

---

## 기본 사용

```vue
<DetailComponent class="ml-2" :title="helpTitle" :details="helpDetails" />
```

**Props**: `title`(필수), `details`(필수), `detailUrl`(선택), `iconSize`(선택)

---

## details 구조

```javascript
helpDetails: [
  { title: 'i18n.key.detail1' },
  { title: 'i18n.key.detail2', icon: 'iconKey' },
  { title: 'i18n.key.detail3', image: 'imageName.png' }
]
```

- `title`: i18n 키 (필수)
- `icon`: Icons 아이콘 키 (선택)
- `image`: `/assets/images/detailImage/` 하위 파일명 (선택)

---

## 사용 예시

```vue
<!-- 다이얼로그 헤더 -->
<div class="d-flex align-center">
  {{ title }}
  <DetailComponent class="ml-2" :title="helpTitle" :details="helpDetails" />
</div>
```

---

## import

```javascript
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
```

---

## i18n 추가 (동시 진행)

**ko.json / en.json** 에 도움말 키 추가 필수. 참조: `agent-ui-md/template/i18n-locales.md`

```json
{
  "기능명": {
    "helpTitle": "도움말 제목",
    "help": {
      "detail1": "첫 번째 설명",
      "detail2": "두 번째 설명"
    }
  }
}
```

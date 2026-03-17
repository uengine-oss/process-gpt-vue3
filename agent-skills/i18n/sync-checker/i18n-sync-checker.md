# i18n 동기화 체크 및 자동 수정

ko.json ↔ en.json 간 키 누락, 라인 불일치, 미번역을 검출하고 자동 수정한다.
기준 파일: **ko.json** (원본), 수정 대상: **en.json**

---

## 절차

### 1단계: 검출

```bash
node agent-ui-md/i18n/sync-checker/check-i18n-sync.mjs
```

### 2단계: 자동 수정 (리포트 결과 기반)

| 리포트 항목 | 수정 방법 |
|------|------|
| `MISSING IN en.json` | ko.json의 해당 키 위치를 확인하고, en.json의 같은 위치에 키를 추가한 뒤 값을 자연스러운 영어로 번역 |
| `MISSING IN ko.json` | en.json에만 존재하는 키 → 사용처 확인 후 ko.json에 한글 번역 추가 |
| `LINE MISMATCH` | ko.json의 키 순서를 기준으로 en.json의 키 구조와 순서를 일치시킴 |
| `UNTRANSLATED IN en.json` | 한글이 남아있는 값을 자연스러운 영어로 번역 |

### 3단계: 재검증

수정 완료 후 1단계 스크립트를 다시 실행하여 Total 0 확인

---

## 수정 원칙
- ko.json이 기준, en.json을 ko.json 구조에 맞춤
- 키 순서는 ko.json과 동일하게 유지
- 번역 시 {변수} 플레이스홀더 보존 필수
- 전문 용어(BPMN, FTE, DMN 등)는 번역하지 않음
- 번역 상세 규칙은 [../i18n-locales.md](../i18n-locales.md) 참고

---

## 주의
- exit code 0 = 정상, 1 = 이슈 존재
- 외부 의존성 없음 (Node.js 내장 모듈만 사용)

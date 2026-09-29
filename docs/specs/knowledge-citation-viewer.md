# Knowledge citation viewer

## Status

1차 구현(2026-09-28~29, `kb-map` 브랜치, 미배포). 인용 형식과 서버 쪽 확인은 process-gpt-codex
`docs/specs/workspace.md#지식베이스-도구`, 뷰어 API 는 process-gpt-memento `docs/specs/knowledge-map.md#인용-뷰어-api`.
근거·측정은 codex `docs/DESIGN_NOTES.md#citation-anchor`.

## 무엇을 하나

지식검색 답변의 인용을 번호 칩으로 바꾸고, 칩을 누르면 원문처럼 보이는 화면을 열어 인용 문장 자리를 칠한다.
PDF 는 원본 쪽, HWPX·DOCX 는 memento 가 만든 변환본 PDF 쪽 위에 칠한다(쪽 번호는 "변환본 기준").

| 파일 | 역할 |
|---|---|
| `src/components/knowledge/citation/kbCitations.js` | 답변 HTML 의 인용 → 칩 + 끝의 출처 목록 |
| `src/components/knowledge/citation/CitationViewer.vue` | 원문 화면과 칠할 자리 결정 |
| `src/components/knowledge/citation/citationApi.js` | memento `/document/blocks`·`/document/page-image`·`/document/locate` |
| `src/components/ui/Chat.vue` | 칩 클릭 → 뷰어 대화상자 |
| `src/views/knowledge/CitationLabPage.vue` | `/knowledge/citation-lab` 확인용 화면 |

## 인용 → 칩 (`withKbCitations`)

마크다운을 HTML 로 바꾼 뒤 `[[<path> › <섹션 제목> · bS-bE · p.N · "발췌"]]` 를 찾는다. 블록(`bS-bE`)·쪽(`p.N`)은 없을 수
있고, 블록도 발췌도 없으면 칩으로 바꾸지 않는다. 발췌 여럿을 `"a" / "b"` 로 붙이면 발췌마다 칩을 단다. `~` 는
`escapeSingleTildes` 가 `&#126;` 로 바꿔 두므로 범위 구분자로 함께 받는다. 칩은 `data-kb-path/start/end/page/quote/title`
을 싣는다. 칩은 답변 본문에서 만들고 `done.sources`(서버가 확인한 범위)는 쓰지 않는다.

## 칠할 자리 (`CitationViewer.narrow`)

앵커는 발췌이고 블록 번호는 힌트다. memento `/document/locate` 로 발췌가 걸친 블록 범위들을 받은 뒤:

1. 블록 힌트가 있으면 힌트 범위와 겹치는 일치 → 가장 가까운 일치
2. 힌트가 없으면 인용 제목의 한 조각(`·`/`›` 로 나눔)과 섹션 제목이 **정확히 같은** 일치 → `p.N` 쪽의 일치 → 첫 일치
3. 발췌를 못 찾고 힌트도 없으면 인용한 섹션 전체를 보여 주고 "발췌 문장을 원문에서 찾지 못해 섹션을 표시"라고 적는다

같은 규칙이 codex `app/knowledge/citations.py pick_match` 에도 있다(바꾸면 둘 다 고친다).

## 알려진 한계

- 2단 PDF 는 memento 파서가 두 단을 한 줄씩 번갈아 추출해, 원문 그대로인 발췌도 찾지 못하고 섹션 표시로 떨어진다
  (검증셋 KoPub). 파서 쪽 과제.
- HWPX 변환본이 아직 없으면 첫 열람이 30~70초 걸린다. 배포 뒤 memento `scripts/prewarm_renditions.py` 로 채운다.

## 테스트

`node --test src/components/knowledge/citation/kbCitations.test.js`

# Feature Specification: 전체 세션 프롬프트 아카이브

**Feature Branch**: `005-prompt-archive`
**Created**: 2026-09-16
**Status**: Living archive (스냅샷 + 이후 수동 갱신)
**Input**: [prompt-history.md](./prompt-history.md)

## 목적

이 프로젝트에서 진행된 **모든 Claude Code 세션의 사용자 프롬프트**를 한 곳에
시간순(원래 타임스탬프)으로 보존한다. 개별 기능 스펙과 달리 구현 대상이 아니라
작업이력 아카이브다.

## 수집 내역

- 2026-09-16 스냅샷: 세션 24개, 프롬프트 184건 (2026-08-31 ~ 2026-09-16).
- 수집 도구: `.claude/skills/speckit-backfill/backfill.sh backfill --feature 005-prompt-archive <세션>.jsonl`
- 세션 경계는 이력 파일의 `<!-- backfilled-from: <세션ID> -->` 마커로 구분된다.

## 갱신 방법

- **자동(기본)**: 2026-09-16부터 `UserPromptSubmit` 훅이 모든 세션의 모든 프롬프트를
  이 아카이브에 실시간 수집한다(활성 스펙 유무와 무관). 세션 첫 프롬프트에
  `<!-- backfilled-from: <세션ID> -->` 마커가 자동으로 남아 중복 백필이 방지된다.
- **수동(갭 보완)**: 훅이 없던 시기의 세션이나 다른 환경의 트랜스크립트는:

```bash
.claude/skills/speckit-backfill/backfill.sh list-sessions   # 새 세션 확인
.claude/skills/speckit-backfill/backfill.sh backfill --feature 005-prompt-archive <세션ID>.jsonl
```

이미 수집된 세션은 마커로 자동 스킵된다.

## 제약 / 알려진 특성

- **훅 등록(2026-09-16) 이전에 시작되어 스냅샷 이후에도 계속된 세션**은 스냅샷 이후
  입력분이 빠져 있고, 마커 때문에 재백필도 스킵된다. 필요하면 해당 세션의 마커
  블록을 지우고 다시 백필한다.
- 아카이브 생성 프롬프트("모든 세션에 대해서…")는 첫 항목과 해당 세션 백필분에
  중복으로 1회 더 존재한다(의도된 허용).
- 개별 기능 스펙(예: 001)의 이력과 내용이 겹칠 수 있다 — 아카이브는 전체 기록,
  기능 스펙 이력은 해당 기능 범위 기록으로 역할이 다르다.
- 트랜스크립트 원본(`~/.claude/projects/-home-kimsanghoon-process-gpt-vue3/*.jsonl`)이
  정리(삭제)되어도 이 아카이브는 레포에 남는다.

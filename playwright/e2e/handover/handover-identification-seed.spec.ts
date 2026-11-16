/**
 * 프로세스 식별 — 단계 구성이 다른 업무 사례를 실제 사용자 흐름으로 쌓는다 (@seed, 느림)
 *
 * 식별 목록이 여러 모양의 업무를 보이도록 사례를 만든다. 사람이 하는 그대로: 시작한 사람이 방의 에이전트와
 * 요청을 정리하고 다음 사람에게 넘기고, 받은 사람도 방의 에이전트와 확인한 뒤 넘기고, 마지막 사람이 받은 일을 끝낸다.
 *
 *   휴가 신청       접수 → 팀장 승인 → 근태 반영                         순차
 *   출장비 정산     영수증 제출 → 금액 확인 → 재무 승인 → 지급 처리        소액 1건은 재무 승인을 건너뜀(옵션)
 *   장비 수리 요청  접수 → 원인 확인 → 수리 진행 | 장비 교체 → 완료 안내   택일
 *   고객 문의 회신  접수 → 답변 작성 → 답변 검토 (→ 수정 → 검토) → 회신    1건은 반려 후 재검토(반복)
 *
 * 만든 데이터는 지우지 않는다. 끝나면 식별 목록에 네 업무가 생겼는지 본다.
 * 실행: HONG_EMAIL=… HONG_PASSWORD=… npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-seed
 */
import { expect, test } from '@playwright/test';
import { BASE, PEOPLE, login, shot } from './helpers';
import { runWork, type Work } from './identification-flow';

test.setTimeout(120 * 60 * 1000);

const HONG = PEOPLE.hong.email;
const LEE = PEOPLE.lee.email;
const PARK = PEOPLE.park.email;

// ---------- 휴가 신청: 홍길동 → 이팀장 → 홍길동 ----------
const leave = (who: string, kind: string, days: string, why: string): Work => ({
    room: `${who} ${kind} 신청`,
    legs: [
        {
            by: 'hong',
            ask: `${who}님이 ${days} ${kind}를 쓰겠다고 신청했어요. 사유는 ${why}입니다. 휴가 신청서에 들어갈 기간·일수·사유·업무 대행자를 정리해 주세요.`,
            pass: {
                done: '휴가 신청 접수',
                next: '팀장 승인',
                to: LEE,
                instruction: `${who}님 ${days} ${kind} 신청입니다. 팀 일정과 겹치는지 보고 승인해 주세요.`
            }
        },
        {
            by: 'lee',
            ask: `${who}님 ${days} ${kind} 신청을 승인하려고 해요. 그 기간 팀 일정에서 확인할 점을 짧게 정리해 주세요.`,
            pass: {
                done: '팀장 승인',
                next: '근태 반영',
                to: HONG,
                instruction: `${who}님 ${days} ${kind} 승인했습니다. 근태에 반영해 주세요.`
            }
        },
        {
            by: 'hong',
            ask: `${who}님 ${days} ${kind}를 근태에 반영할 때 확인할 항목을 정리해 주세요.`,
            finish: `${who}님 ${days} ${kind} 승인했습니다`
        }
    ]
});

// ---------- 출장비 정산: 홍길동 → 박대리 → (이팀장) → 홍길동 ----------
const trip = (who: string, place: string, amount: string, small = false): Work => ({
    room: `${who} ${place} 출장비 정산`,
    legs: [
        {
            by: 'hong',
            ask: `${who}님이 ${place} 출장비 ${amount}을 정산해 달라고 영수증을 보냈어요. 교통비·숙박비·식비로 나눠 정산서 항목을 정리해 주세요.`,
            pass: {
                done: '영수증 제출',
                next: '금액 확인',
                to: PARK,
                instruction: `${who}님 ${place} 출장비 ${amount} 영수증입니다. 규정 한도 안인지 확인해 주세요.`
            }
        },
        small
            ? {
                  by: 'park',
                  ask: `${who}님 ${place} 출장비 ${amount}이 규정 한도 안인지 확인하고, 소액이라 재무 승인 없이 지급해도 되는지 정리해 주세요.`,
                  pass: {
                      done: '금액 확인',
                      next: '지급 처리',
                      to: HONG,
                      instruction: `${who}님 ${place} 출장비 ${amount} 확인했습니다. 소액이라 바로 지급해 주세요.`
                  }
              }
            : {
                  by: 'park',
                  ask: `${who}님 ${place} 출장비 ${amount}이 규정 한도 안인지 항목별로 확인해 주세요.`,
                  pass: {
                      done: '금액 확인',
                      next: '재무 승인',
                      to: LEE,
                      instruction: `${who}님 ${place} 출장비 ${amount} 확인했습니다. 승인해 주세요.`
                  }
              },
        ...(small
            ? []
            : [
                  {
                      by: 'lee',
                      ask: `${who}님 ${place} 출장비 ${amount} 정산을 승인하려고 해요. 승인 의견을 한두 줄로 써 주세요.`,
                      pass: {
                          done: '재무 승인',
                          next: '지급 처리',
                          to: HONG,
                          instruction: `${who}님 ${place} 출장비 ${amount} 승인했습니다. 지급해 주세요.`
                      }
                  }
              ]),
        {
            by: 'hong',
            ask: `${who}님 ${place} 출장비 ${amount} 지급 안내 메시지를 짧게 써 주세요.`,
            finish: `${who}님 ${place} 출장비 ${amount}`
        }
    ]
});

// ---------- 장비 수리 요청: 홍길동 → 박대리 → 이팀장(수리 | 교체) → 홍길동 ----------
const repair = (team: string, device: string, symptom: string, replace: boolean): Work => {
    const step = replace ? '장비 교체' : '수리 진행';
    return {
        room: `${team} ${device} 수리 요청`,
        legs: [
            {
                by: 'hong',
                ask: `${team}에서 ${device}가 ${symptom}며 수리를 요청했어요. 수리 요청서에 들어갈 장비·증상·사용 기간을 정리해 주세요.`,
                pass: {
                    done: '수리 요청 접수',
                    next: '원인 확인',
                    to: PARK,
                    instruction: `${team} ${device} ${symptom} 건입니다. 원인을 확인해 주세요.`
                }
            },
            {
                by: 'park',
                ask: `${team} ${device}가 ${symptom}요. 원인으로 보이는 것과 ${
                    replace ? '교체가 필요한 이유' : '수리로 고칠 수 있는 이유'
                }를 정리해 주세요.`,
                pass: {
                    done: '원인 확인',
                    next: step,
                    to: LEE,
                    instruction: replace
                        ? `${team} ${device}는 수리보다 교체가 낫습니다. 교체를 진행해 주세요.`
                        : `${team} ${device}는 부품 교체로 수리할 수 있습니다. 수리를 진행해 주세요.`
                }
            },
            {
                by: 'lee',
                ask: `${team} ${device} ${replace ? '교체' : '수리'}를 진행하려고 해요. 진행 순서를 짧게 정리해 주세요.`,
                pass: {
                    done: step,
                    next: '완료 안내',
                    to: HONG,
                    instruction: `${team} ${device} ${replace ? '교체' : '수리'} 끝났습니다. ${team}에 알려 주세요.`
                }
            },
            {
                by: 'hong',
                ask: `${team}에 보낼 ${device} ${replace ? '교체' : '수리'} 완료 안내를 짧게 써 주세요.`,
                finish: `${team} ${device} ${replace ? '교체' : '수리'} 끝났습니다`
            }
        ]
    };
};

// ---------- 고객 문의 회신: 홍길동 → 박대리 → 이팀장 (→ 박대리 → 이팀장) → 홍길동 ----------
const inquiry = (customer: string, topic: string, rework: boolean): Work => {
    const legs: Work['legs'] = [
        {
            by: 'hong',
            ask: `${customer}에서 ${topic}에 대해 문의 메일이 왔어요. 문의 내용과 답해야 할 질문을 정리해 주세요.`,
            pass: { done: '문의 접수', next: '답변 작성', to: PARK, instruction: `${customer} ${topic} 문의입니다. 답변 초안을 써 주세요.` }
        },
        {
            by: 'park',
            ask: `${customer}의 ${topic} 문의에 보낼 답변 초안을 써 주세요.`,
            pass: { done: '답변 작성', next: '답변 검토', to: LEE, instruction: `${customer} ${topic} 답변 초안입니다. 검토해 주세요.` }
        }
    ];
    if (rework) {
        legs.push(
            {
                by: 'lee',
                ask: `${customer} ${topic} 답변 초안에서 일정과 비용 설명이 빠졌어요. 보완할 점을 정리해 주세요.`,
                pass: {
                    done: '답변 검토',
                    next: '답변 수정',
                    to: PARK,
                    instruction: `${customer} ${topic} 답변에 일정과 비용 설명을 보완해 주세요.`
                }
            },
            {
                by: 'park',
                ask: `${customer} ${topic} 답변에 일정과 비용 설명을 넣어 다시 써 주세요.`,
                pass: {
                    done: '답변 수정',
                    next: '답변 검토',
                    to: LEE,
                    instruction: `${customer} ${topic} 답변 보완했습니다. 다시 검토해 주세요.`
                }
            }
        );
    }
    legs.push(
        {
            by: 'lee',
            ask: `${customer} ${topic} 답변을 최종 확인하려고 해요. 확인 의견을 한 줄로 써 주세요.`,
            pass: {
                done: '답변 검토',
                next: '회신',
                to: HONG,
                instruction: `${customer} ${topic} 답변 확인했습니다. 고객에게 회신해 주세요.`
            }
        },
        { by: 'hong', ask: `${customer}에 보낼 ${topic} 회신 메일 인사말을 붙여 주세요.`, finish: `${customer} ${topic} 답변 확인했습니다` }
    );
    return { room: `${customer} ${topic} 문의`, legs };
};

const WORKS: Work[] = [
    leave('김민지', '연차', '12월 2일부터 3일간', '가족 행사'),
    leave('최도윤', '반차', '12월 5일 오후', '병원 진료'),
    leave('정하늘', '연차', '12월 23일부터 5일간', '연말 여행'),
    leave('윤서진', '경조 휴가', '12월 9일부터 2일간', '형제 결혼식'),
    trip('김민지', '부산 고객사', '42만 원'),
    trip('최도윤', '대전 전시회', '28만 원'),
    trip('정하늘', '판교 미팅', '3만 5천 원', true),
    trip('윤서진', '제주 워크숍', '67만 원'),
    repair('영업팀', '노트북', '전원이 자주 꺼진다', false),
    repair('재무팀', '프린터', '용지가 계속 걸린다', false),
    repair('디자인팀', '모니터', '화면에 줄이 생겼다', true),
    repair('개발팀', '데스크톱', '부팅이 안 된다', true),
    inquiry('한빛상사', '유지보수 계약 연장', false),
    inquiry('가나전자', '납품 일정 변경', true),
    inquiry('다라물산', '견적 금액 조정', false)
];

test('@seed 단계 구성이 다른 업무 네 가지의 사례를 실제 대화·인계로 쌓는다', async ({ browser }) => {
    const pages = {
        hong: await login(browser, PEOPLE.hong),
        lee: await login(browser, PEOPLE.lee),
        park: await login(browser, PEOPLE.park)
    };
    const done: string[] = [];
    for (const w of WORKS) {
        await runWork(pages, w);
        done.push(w.room);
        test.info().annotations.push({ type: '처리한 건', description: w.room });
    }
    expect(done).toHaveLength(WORKS.length);

    // 식별 목록에 네 업무가 생겼는지(이름은 업무 범주라 모델이 정한다 — 단계로 찾는다)
    const hong = pages.hong;
    await hong.setViewportSize({ width: 1440, height: 900 });
    await hong.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
    await expect(hong.locator('.e2e-work').first()).toBeVisible({ timeout: 600_000 });
    await hong.waitForTimeout(5_000);
    const flows = await hong.locator('.e2e-work .mining-work__flow').allInnerTexts();
    for (const step of ['팀장 승인', '재무 승인', '원인 확인', '답변 검토']) {
        expect(
            flows.some((f) => f.includes(step)),
            `${step} 이 든 업무 — ${JSON.stringify(flows)}`
        ).toBe(true);
    }
    await shot(hong, 'seed-list');
});

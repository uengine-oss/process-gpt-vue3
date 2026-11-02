/**
 * OpenAI TTS 로 한국어 내레이션 음성을 만든다(제품 소개 톤).
 *
 * 실행: cd services/frontend && node e2e/handover/make-narration.mjs
 * 산출물: e2e/handover/narration/NN-<id>.mp3 + narration.json(각 조각 길이 포함)
 *
 * 키는 저장소 루트 .env 의 OPENAI_API_KEY 를 읽는다(코드에 넣지 않는다).
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const OUT_DIR = join(process.cwd(), 'e2e/handover/narration');
const REPO_ROOT = resolve(process.cwd(), '../..');
const MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
const VOICE = process.env.TTS_VOICE || 'alloy';

/** 영상 구간과 1:1 로 맞춘 내레이션. id 는 타임라인 mark 이름과 연결한다. */
export const SCRIPT = [
    {
        id: 'intro',
        text: '업무는 늘 대화 속에서 흘러갑니다. 오늘도 견적 요청 하나가 들어왔습니다. 담당자는 별도 시스템을 열지 않고 대화창에서 에이전트와 함께 일합니다.'
    },
    {
        id: 'work',
        text: '작년 단가표로 견적을 잡고, 볼륨 할인과 납기까지 대화로 정리합니다. 산출물은 이 방 안에 쌓입니다.'
    },
    {
        id: 'gap',
        text: '그런데 여기서 흐름이 끊깁니다. 다음은 상무님 승인이 필요한데, 그 사실은 어디에도 남지 않습니다.'
    },
    {
        id: 'handover',
        text: '그래서 대화창 안에 인계 버튼을 두었습니다. 누르면 이 방에서 만든 산출물이 자동으로 모입니다.'
    },
    {
        id: 'picker',
        text: '다음 담당자는 전체, 사람, 에이전트 탭으로 나눠 고릅니다. 승인은 사람이 해야 하므로 사람 탭에서 박상무를 지정합니다. 이 단계를 실제로 수행해 온 사람은 자격 보유로 표시됩니다.'
    },
    {
        id: 'recorded',
        text: '인계하면 수신자에게 방과 할 일이 만들어지고 산출물이 그대로 넘어갑니다. 누가 누구에게 무엇을 넘겼는지가 이벤트로 기록됩니다.'
    },
    {
        id: 'menu',
        text: '쌓인 기록은 프로세스 식별 메뉴에서 봅니다. 기존 프로세스를 고치는 개선이 아니라, 아직 정의조차 없던 업무를 찾아내는 화면입니다.'
    },
    {
        id: 'threads',
        text: '인계 기록은 이메일 스레드처럼 묶입니다. 한 업무가 여러 방과 여러 담당자를 거쳐도 최초에 시작된 방을 기준으로 한 줄기가 됩니다.'
    },
    {
        id: 'discovered',
        text: '반복되는 흐름에서 프로세스를 도출합니다. 결과는 기존 BPMN 모델러로 그대로 표시됩니다. 역할 레인과 분기까지, 일부 케이스에만 있던 재산출 단계는 건너뛸 수 있는 조건부 단계로 구분됩니다.'
    },
    {
        id: 'proposal',
        text: '도출 결과는 새 프로세스 제안으로 등록됩니다. 살아 있는 프로세스 정의는 바뀌지 않습니다. 사람이 검토하고 승인해야 반영됩니다.'
    },
    {
        id: 'orgmining',
        text: '누가 이 일을 할 수 있는지도 함께 나옵니다. 활동마다 실제 수행자와 근거 건수가 남아, 왜 이 사람이 후보인지 설명됩니다. 사람이 하던 단계와 에이전트가 하던 단계도 구분됩니다.'
    },
    {
        id: 'convert',
        text: '이미 BPMN으로 모델링된 결과가 있으니 프로세스를 말로 다시 설명할 이유가 없습니다. 전환 버튼을 누르면 도출 결과를 그대로 실은 대화창이 열립니다.'
    },
    {
        id: 'autofilled',
        text: '요청문에는 식별된 단계와 담당 역할, 관측 근거가 이미 채워져 있습니다. 사용자는 아무것도 다시 입력하지 않았습니다.'
    },
    {
        id: 'consult',
        text: 'ProcessGPT는 곧바로 만들지 않습니다. 이해한 내용을 먼저 정리해 보여주고 확인을 받습니다.'
    },
    {
        id: 'generate',
        text: '승인하면 실행 가능한 프로세스를 만듭니다. 단계마다 담당 역할과 입력 양식, 분기 조건이 함께 설계됩니다.'
    },
    {
        id: 'save',
        text: '저장하면 바로 쓸 수 있는 프로세스로 등록됩니다. 대화 속에 흩어져 있던 업무가, 이제 조직이 함께 실행하는 표준 프로세스가 되었습니다.'
    }
];

function apiKey() {
    const env = readFileSync(join(REPO_ROOT, '.env'), 'utf-8');
    const m = env.match(/^OPENAI_API_KEY=(.+)$/m);
    if (!m) throw new Error('.env 에서 OPENAI_API_KEY 를 찾지 못했습니다');
    return m[1].trim().replace(/^["']|["']$/g, '');
}

function durationOf(file) {
    try {
        const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
            encoding: 'utf-8'
        });
        return parseFloat(out.trim());
    } catch {
        return null;
    }
}

async function main() {
    mkdirSync(OUT_DIR, { recursive: true });
    const key = apiKey();
    const result = [];

    for (const [i, seg] of SCRIPT.entries()) {
        const file = join(OUT_DIR, `${String(i + 1).padStart(2, '0')}-${seg.id}.mp3`);
        if (existsSync(file) && !process.env.TTS_FORCE) {
            console.log(`건너뜀(이미 있음): ${seg.id}`);
        } else {
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: MODEL,
                    voice: VOICE,
                    input: seg.text,
                    // 제품 소개 톤: 차분하고 신뢰감 있게, 너무 들뜨지 않게
                    instructions: '차분하고 신뢰감 있는 제품 소개 내레이션 톤으로, 또박또박 자연스럽게 읽어주세요.',
                    response_format: 'mp3'
                })
            });
            if (!res.ok) {
                throw new Error(`TTS 실패(${seg.id}): ${res.status} ${(await res.text()).slice(0, 200)}`);
            }
            writeFileSync(file, Buffer.from(await res.arrayBuffer()));
            console.log(`생성: ${seg.id}`);
        }
        result.push({ ...seg, file, duration: durationOf(file) });
    }

    writeFileSync(join(OUT_DIR, 'narration.json'), JSON.stringify(result, null, 2), 'utf-8');
    const total = result.reduce((s, r) => s + (r.duration || 0), 0);
    console.log(`\n총 ${result.length}개 · 합계 ${total.toFixed(1)}초`);
    for (const r of result) console.log(`  ${r.id.padEnd(10)} ${String(r.duration ?? '?').slice(0, 5)}초`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});

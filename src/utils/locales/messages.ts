import en from './en.json';
import ko from './ko.json';

// 화면 단위 번역 조각. parts/<네임스페이스>.<locale>.json 을 두면 자동으로 합쳐진다.
// (거대한 ko.json/en.json 을 여러 작업자가 동시에 고치다 충돌나는 것을 피하기 위한 구조)
const parts = import.meta.glob('./parts/*.json', { eager: true }) as Record<string, any>;

function deepMerge(target: any, source: any) {
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            deepMerge(target[key], value);
        } else {
            target[key] = value;
        }
    }
}

for (const [path, mod] of Object.entries(parts)) {
    const matched = /\/parts\/.+\.(ko|en)\.json$/.exec(path);
    if (!matched) continue;
    deepMerge(matched[1] === 'ko' ? (ko as any) : (en as any), mod.default ?? mod);
}

const messages = {
    en: en,
    ko: ko
};

export default messages;

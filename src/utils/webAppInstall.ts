/**
 * 홈 화면에 추가(웹 페이지를 앱처럼 설치).
 *
 * Process GPT 모드에서만 매니페스트를 붙인다 — PAL · uEngine 은 이름과 아이콘이 다르다(main.ts).
 * 브라우저가 설치 창을 띄울 수 있으면(beforeinstallprompt) 그 신호를 붙잡아 두었다가 「홈 화면에 추가」를
 * 누를 때 띄운다. 붙잡지 않으면 크롬이 아래쪽에 자체 설치 띠를 띄워 휴대폰 화면 질문과 겹친다.
 * iOS 사파리는 설치 창이 없어 공유 단추 › 「홈 화면에 추가」를 안내한다(installGuide).
 */
import { reactive } from 'vue';
import { isStandalone } from '@/shared/mobileView';

export const webAppInstall = reactive({
    /** 이 모드에서 홈 화면에 추가를 권하는가 */
    enabled: false,
    /** 브라우저 설치 창을 띄울 수 있는가 */
    canPrompt: false,
    /** 이미 홈 화면에서 앱처럼 열려 있는가 */
    installed: false
});

let deferredPrompt: any = null;

function addHeadTag(tag: 'link' | 'meta', attrs: Record<string, string>) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
}

export function setupWebAppInstall(): void {
    webAppInstall.enabled = true;
    webAppInstall.installed = isStandalone(window);
    addHeadTag('link', { rel: 'manifest', href: '/manifest.webmanifest' });
    addHeadTag('link', { rel: 'apple-touch-icon', href: '/pwa/apple-touch-icon.png' });
    addHeadTag('meta', { name: 'apple-mobile-web-app-title', content: 'Process GPT' });
    addHeadTag('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    addHeadTag('meta', { name: 'mobile-web-app-capable', content: 'yes' });

    window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        deferredPrompt = e;
        webAppInstall.canPrompt = true;
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        webAppInstall.canPrompt = false;
        webAppInstall.installed = true;
    });
}

/** 브라우저 설치 창을 띄운다. 띄울 수 없으면 'unavailable' — 그때는 기기별 안내를 보여 준다. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt) return 'unavailable';
    const e = deferredPrompt;
    deferredPrompt = null;
    webAppInstall.canPrompt = false;
    await e.prompt();
    const choice = await e.userChoice.catch(() => null);
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
}

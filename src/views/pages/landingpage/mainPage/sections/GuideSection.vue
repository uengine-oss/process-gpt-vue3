<template>
    <section class="guide">
        <div class="container">
            <div class="guide-content">
                <h1 class="guide-title">Process GPT</h1>
                <p class="guide-tagline">{{ $t('LandingGuide.tagline') }}</p>
                <div class="guide-links">
                    <a v-for="link in links" :key="link.key" class="guide-link" :href="link.href" target="_blank" rel="noopener">
                        <span class="guide-link-label">{{ $t(`LandingGuide.${link.key}`) }}</span>
                        <span class="guide-link-hint">{{ $t(`LandingGuide.${link.key}Hint`) }}</span>
                    </a>
                    <a class="guide-link guide-link-start" href="#" @click.prevent="gotoStart()">
                        <span class="guide-link-label">{{ $t('LandingGuide.start') }}</span>
                        <span class="guide-link-hint">{{ $t('LandingGuide.startHint') }}</span>
                    </a>
                </div>
                <div class="guide-install">
                    <div class="guide-install-head">
                        <b>{{ $t('LandingGuide.installTitle') }}</b>
                        <span>{{ $t('LandingGuide.installHint') }}</span>
                    </div>
                    <pre class="guide-install-cmd"><code>{{ install }}</code></pre>
                    <div class="guide-install-foot">
                        <span>{{ $t('LandingGuide.installSafety') }}</span>
                        <span class="guide-install-actions">
                            <a :href="scriptUrl" target="_blank" rel="noopener">{{ $t('LandingGuide.installViewScript') }}</a>
                            <button type="button" @click="copyInstall">{{ copied ? $t('LandingGuide.installCopied') : $t('LandingGuide.installCopy') }}</button>
                        </span>
                    </div>
                </div>
                <p class="guide-note">{{ $t('LandingGuide.note') }}</p>
            </div>
        </div>
    </section>
</template>

<script>
import { homePath } from '@/utils/homePath';
import BackendFactory from '@/components/api/BackendFactory';
import { guideLinks, LITE_INSTALL, LITE_SCRIPT_URL } from './guideLinks';
const backend = BackendFactory.createBackend();

// 소개는 uengine.org 가 맡고, 이 화면은 튜토리얼·GitHub·제품 소개·로그인으로 가는 길만 안내한다.
export default {
    name: 'GuideSection',
    data() {
        return { install: LITE_INSTALL, scriptUrl: LITE_SCRIPT_URL, copied: false };
    },
    computed: {
        links() {
            return guideLinks(this.$i18n.locale);
        }
    },
    methods: {
        async copyInstall() {
            try {
                await navigator.clipboard.writeText(this.install);
                this.copied = true;
                setTimeout(() => (this.copied = false), 2000);
            } catch (e) {
                this.copied = false;
            }
        },
        // HeroSection 과 같은 시작 경로: 로그인 전이면 로그인, 테넌트 서버면 테넌트 관리, 아니면 홈
        async gotoStart() {
            const isLogin = await backend.checkDBConnection();
            if (!isLogin) {
                await this.$router.push('/auth/login');
                return;
            }
            await this.$router.push(window.$isTenantServer ? '/tenant/manage' : homePath());
        }
    }
};
</script>

<style scoped>
.guide {
    padding: 120px 0 100px;
    background-color: var(--bg-color-light);
    min-height: calc(100vh - 180px);
}

.guide-content {
    max-width: 880px;
    margin: 0 auto;
    text-align: center;
}

/* 랜딩 공통 CSS 의 h1 줄 높이가 작아 다음 줄과 겹치므로 여기서 정한다 */
.guide-title {
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 18px;
}

.guide-tagline {
    font-size: 1.15rem;
    line-height: 1.7;
    color: #555;
    margin: 0 auto 48px;
    max-width: 640px;
    word-break: keep-all;
}

.guide-links {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.guide-link {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 22px 18px;
    background: #fff;
    border: 1px solid #e5e5ea;
    border-radius: 14px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
    word-break: keep-all;
}

.guide-link:hover {
    border-color: #1976d2;
    box-shadow: 0 6px 20px rgba(25, 118, 210, 0.12);
}

.guide-link-label {
    font-size: 1.1rem;
    font-weight: 700;
    color: #111;
}

.guide-link-hint {
    font-size: 0.9rem;
    color: #666;
    line-height: 1.5;
}

.guide-link-start {
    background: #1976d2;
    border-color: #1976d2;
}

.guide-link-start .guide-link-label,
.guide-link-start .guide-link-hint {
    color: #fff;
}

.guide-install {
    margin-top: 28px;
    text-align: left;
    background: #fff;
    border: 1px solid #e5e5ea;
    border-radius: 14px;
    padding: 20px 22px;
}

.guide-install-head b {
    display: block;
    font-size: 1.05rem;
    color: #111;
    margin-bottom: 4px;
}

.guide-install-head span,
.guide-install-foot > span:first-child {
    font-size: 0.9rem;
    color: #666;
    line-height: 1.6;
    word-break: keep-all;
}

.guide-install-cmd {
    margin: 14px 0;
    padding: 14px 16px;
    background: #1a1a2e;
    color: #e8e8f0;
    border-radius: 10px;
    font-size: 0.82rem;
    line-height: 1.7;
    overflow-x: auto;
    white-space: pre;
}

.guide-install-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.guide-install-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.9rem;
}

.guide-install-actions button {
    border: 1px solid #1976d2;
    color: #1976d2;
    background: #fff;
    border-radius: 999px;
    padding: 4px 14px;
    cursor: pointer;
}

.guide-note {
    margin-top: 36px;
    font-size: 0.9rem;
    color: #888;
}

@media (max-width: 900px) {
    .guide {
        padding: 80px 0 60px;
    }
    .guide-links {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 480px) {
    .guide-title {
        font-size: 2rem;
    }
    .guide-links {
        grid-template-columns: 1fr;
    }
}
</style>

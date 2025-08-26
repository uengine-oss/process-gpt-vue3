<template>
    <v-container>
        <div class="footer-content">
            <!-- Copyright 및 회사 정보 -->
            <div class="footer-section">
                <div class="copyright">
                    Copyright © uEngine Solutions. All Rights Reserved
                </div>
                <div class="company-info">
                    <div>사업자등록번호 211-87-95355 | 대표 : 장진영</div>
                    <div>서울특별시 서초구 사임당로 31, 301호(서초동, 궁현빌딩) | 고객센터 02-567-8301</div>
                </div>
            </div>
            
            <!-- 약관 링크 -->
            <div class="footer-section">
                <div class="terms-links">
                    <a href="/terms" class="terms-link" target="_blank">서비스 이용약관</a>
                    <a href="/privacy" class="terms-link" target="_blank">개인정보처리방침</a>
                    <!-- <a href="/terms/refund" class="terms-link" target="_blank">취소/환불 정책</a> -->
                </div>
            </div>
            
            <!-- 소셜 미디어 아이콘 -->
            <div class="footer-section" v-if="false">
                <div class="social-icons">
                    <v-btn icon variant="text" class="social-icon">
                        <div class="social-icon-inner">
                            <span class="social-text">TALK</span>
                        </div>
                    </v-btn>
                    <v-btn icon variant="text" class="social-icon">
                        <div class="social-icon-inner">
                            <span class="social-text">N</span>
                        </div>
                    </v-btn>
                </div>
            </div>
        </div>
    </v-container>
</template>

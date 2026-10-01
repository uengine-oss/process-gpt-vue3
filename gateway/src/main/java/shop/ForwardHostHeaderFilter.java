package shop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class ForwardHostHeaderFilter implements GlobalFilter, Ordered {

    private static final Logger logger = LoggerFactory.getLogger(ForwardHostHeaderFilter.class);

    private final JwtVerifier jwtVerifier;

    public ForwardHostHeaderFilter(JwtVerifier jwtVerifier) {
        this.jwtVerifier = jwtVerifier;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String requestPath = request.getURI().getPath();

        if (requestPath.equals("/health")) {
            ServerHttpResponse response = exchange.getResponse();
            response.setStatusCode(HttpStatus.OK);
            return response.setComplete();
        }

        InetSocketAddress host = request.getHeaders().getHost();
        String originalHost = (host != null) ? host.getHostName() : "unknown";

        String subdomain = extractSubdomain(originalHost);

        List<String> protectedPaths = Arrays.asList(
                "/completion/(?!set-tenant|complete|vision-complete|invite-user|create-user|update-user|set-initial-info).*",
                "/memento/.*",
                "/agent/.*",
                "/mcp/.*",
                "/robo/.*");

        boolean requiresAuth = false;

        for (String path : protectedPaths) {
            if (requestPath.matches(path)) {
                requiresAuth = true;
                break;
            }
        }

        // 안전한 헤더 수정 방식 사용
        ServerHttpRequest updatedRequest = request.mutate()
                .header("X-Forwarded-Host", originalHost)
                .header("X-Tenant-Id", subdomain)
                .build();
        ServerWebExchange updatedExchange = exchange.mutate().request(updatedRequest).build();

        if (requiresAuth) {
            String token = null;
            List<HttpCookie> cookies = request.getCookies().getOrDefault("access_token", Collections.emptyList());
            if (!cookies.isEmpty()) {
                token = cookies.get(0).getValue();
            }
            if (isBlank(token)) {
                String authorization = request.getHeaders().getFirst("Authorization");
                if (authorization != null && authorization.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
                    token = authorization.substring(7).trim();
                }
            }
            if (isBlank(token)) {
                return buildErrorResponse(exchange, "TOKEN_MISSING", "Access token is missing");
            }

            // 서명 검증은 JWKS 갱신(HTTP)이 섞일 수 있어 이벤트 루프 밖에서 돌린다.
            final String verifiedToken = token;
            return Mono.fromCallable(() -> validateToken(verifiedToken, subdomain))
                    .subscribeOn(Schedulers.boundedElastic())
                    .flatMap(result -> result.isValid()
                            ? chain.filter(updatedExchange)
                            : buildErrorResponse(exchange, result.getErrorCode(), result.getErrorMessage()));
        }

        return chain.filter(updatedExchange);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private TokenValidationResult validateToken(String token, String expectedSubdomain) {
        final boolean skipTenantCheck = isTenantCheckSkippedHost(expectedSubdomain);
        try {
            Claims claims = jwtVerifier.verify(token);

            @SuppressWarnings("unchecked")
            Map<String, Object> appMetadata = claims.get("app_metadata", Map.class);
            if (appMetadata == null) {
                logger.warn("No app_metadata found in token");
                return new TokenValidationResult(false, "TOKEN_INVALID", "No app_metadata found in token");
            }

            Object tenantIdObj = appMetadata.get("tenant_id");
            if (tenantIdObj == null) {
                logger.warn("No tenant_id found in app_metadata");
                return new TokenValidationResult(false, "TOKEN_INVALID", "No tenant_id found in app_metadata");
            }

            String tenantId = tenantIdObj.toString();
            if (!skipTenantCheck && !expectedSubdomain.equals(tenantId)) {
                logger.warn("Invalid tenant ID: expected {}, found {}", expectedSubdomain, tenantId);
                return new TokenValidationResult(false, "TENANT_MISMATCH", 
                    String.format("Tenant ID mismatch: expected '%s', found '%s'", expectedSubdomain, tenantId));
            }

            return new TokenValidationResult(true, null, null);
        } catch (JwtException e) {
            // 서명 불일치·만료·알 수 없는 키 — 사유는 로그에만 남기고 응답에는 노출하지 않는다.
            logger.warn("JWT rejected: {}", e.getMessage());
            return new TokenValidationResult(false, "TOKEN_INVALID", "Invalid or expired token");
        } catch (Exception e) {
            logger.error("Exception during token validation", e);
            return new TokenValidationResult(false, "TOKEN_INVALID", "Token validation failed");
        }
    }

    private Mono<Void> buildErrorResponse(ServerWebExchange exchange, String errorCode, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        
        String errorJson = String.format(
            "{\"errorCode\":\"%s\",\"message\":\"%s\",\"status\":401}",
            errorCode, message.replace("\"", "\\\"")
        );
        
        DataBufferFactory bufferFactory = response.bufferFactory();
        DataBuffer buffer = bufferFactory.wrap(errorJson.getBytes(StandardCharsets.UTF_8));
        
        return response.writeWith(Mono.just(buffer));
    }

    private String extractSubdomain(String host) {
        // IP 리터럴(예: 34.22.71.73)은 서브도메인 개념이 없다 — 점으로 쪼개면
        // 첫 옥텟("34")을 테넌트로 오인해 TENANT_MISMATCH 가 났다. 전체를 그대로 반환한다.
        if (isIpAddress(host)) {
            return host;
        }
        String[] parts = host.split("\\.");
        if (parts.length > 2) {
            return parts[0];
        }
        return host;
    }

    /** IPv4 리터럴 또는 IPv6 리터럴(콜론 포함) 여부 */
    private boolean isIpAddress(String host) {
        if (host == null) {
            return false;
        }
        return host.matches("^\\d{1,3}(\\.\\d{1,3}){3}$") || host.contains(":");
    }

    /**
     * 테넌트 검증을 건너뛰는 호스트: localhost 및 IP 직접 접근.
     * 서브도메인 기반 테넌트 라우팅이 없는 접근이므로 토큰의 tenant_id 만으로 처리한다.
     * (기존 isLocalHost 는 extractSubdomain 이후의 "127" 값과 비교해 127.0.0.1 조차
     *  스킵되지 않는 버그가 있었다 — IP 판정으로 함께 해소)
     */
    private boolean isTenantCheckSkippedHost(String host) {
        if (host == null) {
            return false;
        }
        String h = host.toLowerCase(Locale.ROOT);
        return "localhost".equals(h) || isIpAddress(h);
    }

    @Override
    public int getOrder() {
        return -1;
    }

    private static class TokenValidationResult {
        private final boolean valid;
        private final String errorCode;
        private final String errorMessage;

        public TokenValidationResult(boolean valid, String errorCode, String errorMessage) {
            this.valid = valid;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
        }

        public boolean isValid() {
            return valid;
        }

        public String getErrorCode() {
            return errorCode;
        }

        public String getErrorMessage() {
            return errorMessage;
        }
    }
}

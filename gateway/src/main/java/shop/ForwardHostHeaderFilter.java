package shop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class ForwardHostHeaderFilter implements GlobalFilter, Ordered {

    private static final Logger logger = LoggerFactory.getLogger(ForwardHostHeaderFilter.class);

    private static final String SECRET_KEY = Optional.ofNullable(System.getenv("SECRET_KEY"))
        .orElse("super-secret-jwt-token-with-at-least-32-characters-long");

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
            "/execution/(?!set-tenant|complete|vision-complete).*",
            "/autonomous/.*",
            "/memento/.*"
        );

        boolean requiresAuth = false;

        for (String path : protectedPaths) {
            if (requestPath.matches(path)) {
                requiresAuth = true;
                break;
            }
        }

        if (requiresAuth) {
            List<HttpCookie> cookies = request.getCookies().getOrDefault("access_token", Collections.emptyList());
            if (cookies.isEmpty() || !isValidToken(cookies.get(0).getValue(), subdomain)) {
                ServerHttpResponse response = exchange.getResponse();
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return response.setComplete();
            }
        }

        ServerHttpRequest updatedRequest = request.mutate()
            .header("X-Forwarded-Host", originalHost)
            .build();

        return chain.filter(exchange.mutate().request(updatedRequest).build());
    }

    private boolean isValidToken(String token, String expectedSubdomain) {
        try {
            Claims claims = Jwts.parser()
                .setSigningKey(SECRET_KEY.getBytes(StandardCharsets.UTF_8))
                .parseClaimsJws(token)
                .getBody();

            @SuppressWarnings("unchecked")
            Map<String, Object> appMetadata = claims.get("app_metadata", Map.class);
            String tenantId = ((Map<String, Object>) appMetadata).get("tenant_id").toString();
            if (!expectedSubdomain.equals(tenantId)) {
                logger.warn("Invalid tenant ID: expected {}, found {}", expectedSubdomain, tenantId);
                return false;
            }

            return true;
        } catch (SignatureException e) {
            logger.error("SignatureException: Invalid token signature", e);
            return false;
        } catch (Exception e) {
            logger.error("Exception during token validation", e);
            return false;
        }
    }

    private String extractSubdomain(String host) {
        String[] parts = host.split("\\.");
        if (parts.length > 2) {
            return parts[0];
        }
        return host;
    }

    @Override
    public int getOrder() {
        return -1;
    }
}

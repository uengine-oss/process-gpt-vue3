package shop;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.PublicKey;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Supabase 가 발급한 JWT 의 서명을 검증한다.
 *
 * - HS256/384/512 : 공유 시크릿(SECRET_KEY = Supabase JWT secret). service_role·anon 같은 레거시 키.
 * - ES256/RS256 등: Supabase JWKS(/auth/v1/.well-known/jwks.json)의 공개키. 로그인 사용자 토큰.
 *
 * 서명이 맞지 않거나 키를 찾을 수 없는 토큰은 예외 없이 모두 거부한다.
 * (예전에는 서명 실패 시 payload 만 디코드해 통과시키는 폴백이 있었다 — 위조 토큰으로 우회 가능했다.)
 */
@Component
public class JwtVerifier {

    private static final Logger logger = LoggerFactory.getLogger(JwtVerifier.class);

    /** 모르는 kid 로 JWKS 를 다시 받는 최소 간격 — 위조 토큰으로 JWKS 엔드포인트를 두드리는 것을 막는다. */
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofSeconds(60);

    private final SecretKey hmacKey;
    private final URI jwksUri;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private volatile Map<String, PublicKey> publicKeys = Map.of();
    private volatile long lastFetchMillis = 0L;

    public JwtVerifier() {
        String secret = readSetting("SECRET_KEY");
        if (secret == null || secret.isBlank()) {
            logger.warn("SECRET_KEY 가 설정되지 않았습니다 — HS* 서명 토큰은 모두 거부됩니다.");
            this.hmacKey = null;
        } else {
            this.hmacKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        }
        this.jwksUri = URI.create(resolveJwksUrl());
        logger.info("JWKS endpoint: {}", jwksUri);
        refreshKeys();
    }

    /** 서명·만료를 검증하고 claims 를 돌려준다. 실패 시 {@link JwtException}. 블로킹 호출이 있을 수 있다. */
    public Claims verify(String token) {
        return Jwts.parser()
                .keyLocator(new LocatorAdapter<Key>() {
                    @Override
                    protected Key locate(JwsHeader header) {
                        return keyFor(header);
                    }
                })
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Key keyFor(JwsHeader header) {
        String alg = header.getAlgorithm();
        if (alg != null && alg.startsWith("HS")) {
            if (hmacKey == null) {
                throw new UnsupportedJwtException("HMAC signed token but SECRET_KEY is not configured");
            }
            return hmacKey;
        }
        String kid = header.getKeyId();
        if (kid == null) {
            throw new UnsupportedJwtException("Asymmetric token without kid");
        }
        PublicKey key = publicKeys.get(kid);
        if (key == null && refreshAllowed()) {
            refreshKeys();
            key = publicKeys.get(kid);
        }
        if (key == null) {
            throw new UnsupportedJwtException("Unknown signing key id");
        }
        return key;
    }

    private boolean refreshAllowed() {
        return System.currentTimeMillis() - lastFetchMillis >= MIN_REFRESH_INTERVAL.toMillis();
    }

    private synchronized void refreshKeys() {
        lastFetchMillis = System.currentTimeMillis();
        try {
            HttpRequest request = HttpRequest.newBuilder(jwksUri)
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                logger.warn("JWKS fetch failed: HTTP {}", response.statusCode());
                return;
            }
            JwkSet set = Jwks.setParser().build().parse(response.body());
            Map<String, PublicKey> next = new HashMap<>();
            for (Jwk<?> jwk : set.getKeys()) {
                if (jwk.getId() != null && jwk.toKey() instanceof PublicKey publicKey) {
                    next.put(jwk.getId(), publicKey);
                }
            }
            publicKeys = Map.copyOf(next);
            logger.info("Loaded {} JWKS public key(s)", next.size());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("JWKS fetch interrupted");
        } catch (Exception e) {
            logger.warn("JWKS fetch failed: {}", e.toString());
        }
    }

    private static String resolveJwksUrl() {
        String explicit = readSetting("SUPABASE_JWKS_URL");
        if (explicit != null && !explicit.isBlank()) {
            return explicit;
        }
        String base = readSetting("SUPABASE_URL");
        if (base == null || base.isBlank()) {
            base = "http://127.0.0.1:54321";
        }
        return base.replaceAll("/+$", "") + "/auth/v1/.well-known/jwks.json";
    }

    /** .env 로더가 System property 로 넣은 값을 환경변수보다 먼저 본다 (Application.loadEnvFile 참고). */
    private static String readSetting(String key) {
        String value = System.getProperty(key);
        return value != null ? value : System.getenv(key);
    }
}

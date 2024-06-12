package shop;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class ForwardHostHeaderFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String originalHost = request.getHeaders().getHost().getHostName();

        // 원본 호스트 이름을 'X-Forwarded-Host' 헤더로 추가
        ServerHttpRequest updatedRequest = request.mutate()
            .header("X-Forwarded-Host", originalHost)
            .build();

        return chain.filter(exchange.mutate().request(updatedRequest).build());
    }

    @Override
    public int getOrder() {
        // 필터 순서, 필요에 따라 조정
        return -1;
    }
}
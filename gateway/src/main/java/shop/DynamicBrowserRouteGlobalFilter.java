package shop;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR;
import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR;

/**
 * Global filter that dynamically routes browser-server requests.
 * This filter runs AFTER RouteToRequestUrlFilter (order MAX_VALUE)
 * but BEFORE NettyRoutingFilter.
 */
@Component
public class DynamicBrowserRouteGlobalFilter implements GlobalFilter, Ordered {

    // Pattern to match /api/processgpt-browser-server-{0-4}/... or
    // /vnc/processgpt-browser-server-{0-4}/...
    private static final Pattern BROWSER_SERVER_PATTERN = Pattern
            .compile("^/(api|vnc)/processgpt-browser-server-([0-4])(/.*)?$");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        Matcher matcher = BROWSER_SERVER_PATTERN.matcher(path);

        if (matcher.matches()) {
            String type = matcher.group(1); // "api" or "vnc"
            String index = matcher.group(2); // "0", "1", "2", "3", or "4"
            String remainingPath = matcher.group(3); // e.g., "/vnc.html" or null

            if (remainingPath == null || remainingPath.isEmpty()) {
                remainingPath = "/";
            }

            int port;
            if ("api".equals(type)) {
                port = 5001;
            } else if ("vnc".equals(type)) {
                port = 6080;
            } else {
                return chain.filter(exchange);
            }

            // Build the target URI
            String host = "browser-server-" + index;
            URI targetUri = UriComponentsBuilder.newInstance()
                    .scheme("http")
                    .host(host)
                    .port(port)
                    .path(remainingPath)
                    .query(exchange.getRequest().getURI().getRawQuery())
                    .build(true)
                    .toUri();

            System.out.println("DEBUG: DynamicBrowserRouteGlobalFilter - type: " + type + ", index: " + index);
            System.out.println("DEBUG: DynamicBrowserRouteGlobalFilter - original path: " + path);
            System.out.println("DEBUG: DynamicBrowserRouteGlobalFilter - remaining path: " + remainingPath);
            System.out.println("DEBUG: DynamicBrowserRouteGlobalFilter - targetUri: " + targetUri);

            // Override the GATEWAY_REQUEST_URL_ATTR with our target URI
            exchange.getAttributes().put(GATEWAY_REQUEST_URL_ATTR, targetUri);
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        // Run AFTER RouteToRequestUrlFilter (which has order MAX_VALUE)
        // We use MAX_VALUE - 1 to run just before NettyRoutingFilter
        return Ordered.LOWEST_PRECEDENCE - 1;
    }
}

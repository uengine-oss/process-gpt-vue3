package processGPT.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.annotation.RegisteredOAuth2AuthorizedClient;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/test")
public class TestController {

    @RequestMapping(value = "/permitAll", method = RequestMethod.GET)
    public ResponseEntity<String> permitAll() {
        return ResponseEntity.ok("OK! Everybody can access this resource.\n");
    }

    @RequestMapping(value = "/authenticated", method = RequestMethod.GET)
    public ResponseEntity<String> authenticated() {
        return ResponseEntity.ok(
            "OK! Authenticated Users can access this resource.\n"
        );
    }

    @PreAuthorize("hasRole('ROLE_USER')")
    @RequestMapping(value = "/user")
    public ResponseEntity<String> userRoleOnly() {
        return ResponseEntity.ok(
            "OK! Only Users with USER Role can access this resource.\n"
        );
    }

    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @RequestMapping(value = "/admin")
    public ResponseEntity<String> adminRoleOnly() {
        return ResponseEntity.ok(
            "OK! Only Users with ADMIN Role can access this resource.\n"
        );
    }

    @PreAuthorize("hasAuthority('SCOPE_execution')")
    @RequestMapping(value = "/execution", method = RequestMethod.GET)
    public ResponseEntity<String> scopeExecutionOnly() {
        return ResponseEntity.ok(
            "OK! Only Users with scope_execution can access this resource.\n"
        );
    }

    @GetMapping("/token")
    public String getToken(
        @RegisteredOAuth2AuthorizedClient OAuth2AuthorizedClient authorizedClient
    ) {
        return authorizedClient.getAccessToken().getTokenValue();
    }

    @GetMapping("/principal")
    public OidcUser getUser(@AuthenticationPrincipal OidcUser oidcUser) {
        return oidcUser;
    }
}

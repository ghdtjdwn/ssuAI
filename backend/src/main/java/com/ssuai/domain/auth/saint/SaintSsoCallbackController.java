package com.ssuai.domain.auth.saint;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssuai.domain.auth.AuthProperties;
import com.ssuai.domain.user.entity.Student;
import com.ssuai.domain.user.service.StudentService;
import com.ssuai.global.auth.JwtProperties;
import com.ssuai.global.auth.JwtProvider;
import com.ssuai.global.exception.SaintAuthFailedException;
import com.ssuai.global.exception.SaintPortalUnavailableException;

/**
 * u-SAINT SSO entry + callback (Task 14). Implements the redirect-callback
 * pattern from ADR 0014: the browser is sent to SmartID with our backend's
 * own URL as {@code apiReturnUrl}, so SmartID 302s back here with
 * {@code sToken} + {@code sIdno} in the query string. Same origin, no SOP
 * dance.
 *
 * <p>This controller never sees the user's SSU password — SmartID handles
 * that on its own login page. The one-shot tokens received here are
 * consumed inside {@link SaintSsoService#authenticate(String, String)}
 * and discarded; only the resulting ssuAI JWT pair leaves the method.
 *
 * <p>All error paths 302-redirect to the frontend with an
 * {@code ?error=...} query parameter rather than returning a JSON error
 * envelope, because the browser is mid-navigation and the user-visible
 * surface is the frontend `/auth/return` page.
 */
@RestController
@RequestMapping("/api/auth/saint")
public class SaintSsoCallbackController {

    private static final Logger log = LoggerFactory.getLogger(SaintSsoCallbackController.class);

    private final SaintSsoService saintSsoService;
    private final StudentService studentService;
    private final JwtProvider jwtProvider;
    private final JwtProperties jwtProperties;
    private final AuthProperties authProperties;
    private final String frontendOrigin;

    public SaintSsoCallbackController(
            SaintSsoService saintSsoService,
            StudentService studentService,
            JwtProvider jwtProvider,
            JwtProperties jwtProperties,
            AuthProperties authProperties,
            @Value("${ssuai.frontend.origin:}") String frontendOrigin) {
        if (frontendOrigin == null || frontendOrigin.isBlank()) {
            throw new IllegalStateException(
                    "ssuai.frontend.origin (env: SSUAI_FRONTEND_ORIGIN) must be set; "
                            + "the SSO callback cannot 302 the user back to the frontend without it.");
        }
        this.saintSsoService = saintSsoService;
        this.studentService = studentService;
        this.jwtProvider = jwtProvider;
        this.jwtProperties = jwtProperties;
        this.authProperties = authProperties;
        this.frontendOrigin = frontendOrigin;
    }

    @GetMapping("/sso-init")
    public ResponseEntity<Void> ssoInit() {
        String callback = authProperties.getApiBaseUrl() + "/api/auth/saint/sso-callback";
        String encoded = URLEncoder.encode(callback, StandardCharsets.UTF_8);
        URI redirect = URI.create(
                authProperties.getSmartidSsoUrl() + "?apiReturnUrl=" + encoded);
        return ResponseEntity.status(HttpStatus.FOUND).location(redirect).build();
    }

    @GetMapping("/sso-callback")
    public ResponseEntity<Void> ssoCallback(
            @RequestParam(required = false) String sToken,
            @RequestParam(required = false) String sIdno,
            HttpServletResponse response) {
        try {
            UsaintAuthResult identity = saintSsoService.authenticate(sToken, sIdno);
            Student student = studentService.upsertOnLogin(
                    identity.studentId(),
                    identity.name(),
                    identity.major(),
                    identity.enrollmentStatus());

            String refresh = jwtProvider.issueRefresh(student);
            response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(refresh).toString());

            return redirect(frontendReturn("ok", "1"));
        } catch (SaintAuthFailedException exception) {
            log.info("saint sso-callback auth failed: {}", exception.getMessage());
            return redirect(frontendReturn("error", "auth_failed"));
        } catch (SaintPortalUnavailableException exception) {
            log.warn("saint sso-callback portal unavailable: {}", exception.getMessage());
            return redirect(frontendReturn("error", "portal_unavailable"));
        } catch (Exception exception) {
            // Catch-all so the user is always returned to the frontend with
            // an actionable error, never left on a backend 5xx page.
            log.warn("saint sso-callback unknown failure", exception);
            return redirect(frontendReturn("error", "unknown"));
        }
    }

    private ResponseCookie buildRefreshCookie(String refreshToken) {
        AuthProperties.RefreshCookie cookieConfig = authProperties.getRefreshCookie();
        return ResponseCookie.from(cookieConfig.getName(), refreshToken)
                .httpOnly(true)
                .secure(cookieConfig.isSecure())
                .sameSite(cookieConfig.getSameSite())
                .path(cookieConfig.getPath())
                .maxAge(jwtProperties.getRefreshTtl())
                .build();
    }

    private URI frontendReturn(String key, String value) {
        return URI.create(frontendOrigin + "/auth/return?" + key + "="
                + URLEncoder.encode(value, StandardCharsets.UTF_8));
    }

    private static ResponseEntity<Void> redirect(URI location) {
        return ResponseEntity.status(HttpStatus.FOUND).location(location).build();
    }
}

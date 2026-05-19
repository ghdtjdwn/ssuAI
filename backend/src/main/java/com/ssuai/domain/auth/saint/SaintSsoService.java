package com.ssuai.domain.auth.saint;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.ssuai.global.exception.SaintAuthFailedException;
import com.ssuai.global.exception.SaintPortalUnavailableException;

/**
 * Confirms a SSU student's identity through the saint.ssu.ac.kr two-phase handshake.
 *
 * <p>Phase 1 — GET /webSSO/sso.jsp — validates the one-shot tokens and returns Set-Cookie
 * headers with the initial portal session cookies.
 *
 * <p>Phase 2 — GET /irj/portal — follows redirects manually using java.net.http.HttpClient
 * with Redirect.NEVER so that Set-Cookie headers on intermediate 302 responses are captured.
 * The SAP portal issues the authoritative MYSAPSSO2 on a redirect response; a client that
 * silently follows redirects (e.g. HttpURLConnection) drops that cookie and stores an older,
 * ECC-incompatible token instead.
 *
 * <p>Security invariants:
 * <ul>
 *   <li>sToken / sIdno are method-scoped locals — never logged, persisted, or returned.
 *   <li>Portal cookies are stored encrypted in SaintSessionStore once identity is confirmed.
 *   <li>Cookie and token values are never echoed into responses or log lines.
 * </ul>
 */
@Service
public class SaintSsoService {

    private static final Logger log = LoggerFactory.getLogger(SaintSsoService.class);

    private static final String PHASE1_SUCCESS_MARKER = "location.href = \"/irj/portal\"";
    private static final String IDENTITY_NAME_SELECTOR = ".top_user";
    // Live portal greets with "{이름}님 접속을 환영합니다." Keep shorter variants as fallbacks
    // so a copy change on the SSU side does not break login.
    private static final List<String> NAME_GREETING_SUFFIXES = List.of(
            "님 접속을 환영합니다.", "님 환영합니다.", "님");
    private static final String BROWSER_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final int MAX_PHASE2_REDIRECTS = 10;

    private final SaintSsoProperties properties;
    private final RestClient restClient;
    private final HttpClient httpClient;
    private final SaintSessionStore sessionStore;

    @Autowired
    public SaintSsoService(
            SaintSsoProperties properties,
            @Qualifier("saintSsoRestClient") RestClient restClient,
            SaintSessionStore sessionStore) {
        this(properties, restClient, sessionStore,
                HttpClient.newBuilder()
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .connectTimeout(properties.getTimeout())
                        .build());
    }

    SaintSsoService(
            SaintSsoProperties properties,
            RestClient restClient,
            SaintSessionStore sessionStore,
            HttpClient httpClient) {
        this.properties = properties;
        this.restClient = restClient;
        this.sessionStore = sessionStore;
        this.httpClient = httpClient;
    }

    public UsaintAuthResult authenticate(String sToken, String sIdno) {
        if (sToken == null || sToken.isBlank()) {
            throw new SaintAuthFailedException("sToken is required");
        }
        if (sIdno == null || sIdno.isBlank()) {
            throw new SaintAuthFailedException("sIdno is required");
        }

        ResponseEntity<String> phase1 = phase1Validate(sToken, sIdno);
        String phase1Cookies = buildCookieHeader(phase1.getHeaders().get(HttpHeaders.SET_COOKIE));
        if (phase1Cookies.isEmpty()) {
            throw new SaintAuthFailedException("phase 1 returned no Set-Cookie headers");
        }

        String portalEntryUrl = properties.getPortalUrl();
        if (isPhase1Redirect(phase1.getStatusCode().value())) {
            String location = phase1.getHeaders().getFirst(HttpHeaders.LOCATION);
            if (location != null && !location.isBlank()) {
                try {
                    portalEntryUrl = URI.create(properties.getSsoUrl()).resolve(location).toString();
                } catch (IllegalArgumentException ignored) {
                    // Keep the configured portal URL if the upstream Location is malformed.
                }
            }
        }

        Phase2Result phase2 = phase2FetchPortal(phase1Cookies, portalEntryUrl);
        // phase2.cookieHeader() aggregates all Set-Cookie across the redirect chain.
        // Overlay wins on conflict — the portal's fresh MYSAPSSO2 replaces the older
        // /webSSO/sso.jsp token that would otherwise cause ECC 403.
        String mergedCookies = mergeCookieHeaders(phase1Cookies, phase2.cookieHeader());

        log.info("saint sso cookies stored: names={}", cookieNames(mergedCookies));

        UsaintAuthResult identity = parseIdentity(phase2.body(), sIdno);
        sessionStore.put(identity.studentId(), new PortalCookies(mergedCookies));
        return identity;
    }

    private ResponseEntity<String> phase1Validate(String sToken, String sIdno) {
        URI uri = URI.create(properties.getSsoUrl()
                + "?sToken=" + URLEncoder.encode(sToken, StandardCharsets.UTF_8)
                + "&sIdno=" + URLEncoder.encode(sIdno, StandardCharsets.UTF_8));
        ResponseEntity<String> response;
        try {
            response = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.COOKIE, "sToken=" + sToken + "; sIdno=" + sIdno)
                    .header("Referer", "https://smartid.ssu.ac.kr/Symtra_sso/smln.asp")
                    .header(HttpHeaders.USER_AGENT, BROWSER_UA)
                    .retrieve()
                    .toEntity(String.class);
        } catch (ResourceAccessException exception) {
            throw new SaintAuthFailedException("saint phase 1 timeout/io", exception);
        } catch (RestClientResponseException exception) {
            throw new SaintAuthFailedException(
                    "saint phase 1 http " + exception.getStatusCode().value(), exception);
        }

        int status = response.getStatusCode().value();
        String body = response.getBody();

        log.info("saint sso phase1: status={} body_prefix='{}'",
                status,
                bodyPrefix(body));

        if (isPhase1Redirect(status)) {
            String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
            log.info("saint sso phase1: redirect location={}", location);
            if (location != null && location.contains("irj/portal")) {
                return response;
            }
            throw new SaintAuthFailedException("saint phase 1 unexpected redirect: " + location);
        }

        if (body == null || !body.contains(PHASE1_SUCCESS_MARKER)) {
            throw new SaintAuthFailedException("saint phase 1 success marker missing");
        }
        return response;
    }

    /**
     * Fetches the SAP portal with manual redirect following so Set-Cookie headers on
     * 302 responses are captured. HttpURLConnection silently follows redirects and drops
     * intermediate Set-Cookie — that's why phase-2 must use HttpClient with Redirect.NEVER.
     */
    private Phase2Result phase2FetchPortal(String initialCookieHeader, String startUrl) {
        String currentCookies = initialCookieHeader;
        String currentUrl = startUrl;
        String accumulatedNewCookies = "";

        for (int hop = 0; hop <= MAX_PHASE2_REDIRECTS; hop++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(currentUrl))
                    .header("Cookie", currentCookies)
                    .header("User-Agent", BROWSER_UA)
                    .header("Accept", "text/html,application/xhtml+xml")
                    .header("Accept-Language", "ko")
                    .timeout(properties.getTimeout())
                    .GET()
                    .build();

            HttpResponse<String> response;
            try {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            } catch (java.net.http.HttpTimeoutException ex) {
                throw new SaintPortalUnavailableException("saint phase 2 timeout/io", ex);
            } catch (IOException ex) {
                throw new SaintPortalUnavailableException("saint phase 2 io error", ex);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new SaintPortalUnavailableException("saint phase 2 interrupted", ex);
            }

            // Accumulate Set-Cookie from this hop (e.g. MYSAPSSO2 on the first 302).
            String stepCookies = buildCookieHeader(response.headers().allValues("Set-Cookie"));
            if (!stepCookies.isBlank()) {
                accumulatedNewCookies = mergeCookieHeaders(accumulatedNewCookies, stepCookies);
                currentCookies = mergeCookieHeaders(currentCookies, stepCookies);
            }

            int status = response.statusCode();
            if (status == 200) {
                return new Phase2Result(response.body(), accumulatedNewCookies);
            }
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = response.headers().firstValue("Location").orElse(null);
                if (location == null || location.isBlank()) {
                    throw new SaintPortalUnavailableException("saint phase 2 redirect missing Location");
                }
                try {
                    currentUrl = URI.create(currentUrl).resolve(location).toString();
                } catch (IllegalArgumentException ex) {
                    throw new SaintPortalUnavailableException("saint phase 2 malformed redirect location");
                }
                continue;
            }
            if (status / 100 == 5) {
                String snippet = response.body() == null ? "(null)"
                        : response.body().substring(0, Math.min(300, response.body().length()));
                log.warn("saint phase 2 5xx: status={} snippet='{}'", status, snippet);
                throw new SaintPortalUnavailableException("saint phase 2 http " + status);
            }
            log.warn("saint phase 2 unexpected status={}", status);
            throw new SaintPortalUnavailableException("saint phase 2 http " + status);
        }
        throw new SaintPortalUnavailableException("saint phase 2 redirect loop (>" + MAX_PHASE2_REDIRECTS + ")");
    }

    private static boolean isPhase1Redirect(int status) {
        return status == 301 || status == 302;
    }

    private static String bodyPrefix(String body) {
        if (body == null) {
            return "(null)";
        }
        return body.substring(0, Math.min(400, body.length()))
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record Phase2Result(String body, String cookieHeader) {}

    private UsaintAuthResult parseIdentity(String portalHtml, String sIdno) {
        if (portalHtml == null || portalHtml.isBlank()) {
            throw new SaintPortalUnavailableException("phase 2 portal HTML is empty");
        }
        Document document = Jsoup.parse(portalHtml);
        String name = extractName(document);
        // sIdno survived phase 1's success-marker check — trust it as the authoritative
        // student id. The portal main page only echoes 학번 inside JS config.
        return new UsaintAuthResult(sIdno.trim(), name, null, null);
    }

    private static String extractName(Document document) {
        Element nameElement = document.selectFirst(IDENTITY_NAME_SELECTOR);
        if (nameElement == null) {
            throw new SaintPortalUnavailableException(
                    "portal HTML missing greeting element (" + IDENTITY_NAME_SELECTOR + ")");
        }
        String raw = nameElement.text().trim();
        if (raw.isBlank()) {
            throw new SaintPortalUnavailableException("portal HTML greeting element is blank");
        }
        for (String suffix : NAME_GREETING_SUFFIXES) {
            if (raw.endsWith(suffix)) {
                String stripped = raw.substring(0, raw.length() - suffix.length()).trim();
                if (!stripped.isBlank()) {
                    return stripped;
                }
            }
        }
        throw new SaintPortalUnavailableException(
                "portal HTML greeting did not match any known name suffix");
    }

    private static String buildCookieHeader(List<String> setCookies) {
        if (setCookies == null || setCookies.isEmpty()) {
            return "";
        }
        return setCookies.stream()
                .map(SaintSsoService::stripCookieAttributes)
                .filter(cookie -> !cookie.isBlank())
                .collect(Collectors.joining("; "));
    }

    private static String stripCookieAttributes(String setCookieHeader) {
        int semicolon = setCookieHeader.indexOf(';');
        String pair = semicolon < 0 ? setCookieHeader : setCookieHeader.substring(0, semicolon);
        return pair.trim();
    }

    private static String mergeCookieHeaders(String base, String overlay) {
        if (overlay == null || overlay.isBlank()) {
            return base;
        }
        java.util.LinkedHashMap<String, String> jar = new java.util.LinkedHashMap<>();
        for (String pair : base.split(";")) {
            addPairToJar(jar, pair.trim());
        }
        for (String pair : overlay.split(";")) {
            addPairToJar(jar, pair.trim());
        }
        return jar.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("; "));
    }

    private static void addPairToJar(java.util.LinkedHashMap<String, String> jar, String pair) {
        if (pair == null || pair.isEmpty()) return;
        int eq = pair.indexOf('=');
        if (eq <= 0) return;
        jar.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
    }

    private static String cookieNames(String cookieHeader) {
        List<String> names = new ArrayList<>();
        for (String pair : cookieHeader.split(";")) {
            String trimmed = pair.trim();
            int eq = trimmed.indexOf('=');
            if (eq > 0) names.add(trimmed.substring(0, eq).trim());
        }
        return String.join(",", names);
    }

}

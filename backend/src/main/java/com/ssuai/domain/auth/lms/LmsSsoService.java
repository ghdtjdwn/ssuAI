package com.ssuai.domain.auth.lms;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.ssuai.global.exception.LmsAuthFailedException;

/**
 * LMS two-phase auth after SmartID SSO.
 *
 * <p>Phase 1 — GET {@code lms.ssu.ac.kr/xn-sso/gw-cb.php?sToken=&sIdno=}
 * with the one-shot SmartID tokens. gw-cb.php validates with SmartID,
 * issues LMS session cookies, and 302-redirects to the LMS homepage. We
 * do NOT follow the redirect so the 302's Set-Cookie headers are captured.
 *
 * <p>Phase 2 — GET {@code canvas.ssu.ac.kr/learningx/dashboard?user_login={sIdno}}
 * with the phase 1 cookies. Canvas issues its own session cookies including
 * {@code xn_api_token} (JWT, 2h TTL), {@code _legacy_normandy_session},
 * and {@code _normandy_session}. These are the auth credentials the
 * {@code RealLmsAssignmentsConnector} sends to the canvas API.
 *
 * <p>Both sets of cookies are merged and stored encrypted in
 * {@link LmsSessionStore} keyed by {@code sIdno} (= ssuAI studentId).
 * The TTL is bound by the shorter of the two cookie lifetimes; the
 * store default of 2h matches the {@code xn_api_token} JWT expiry.
 */
@Service
public class LmsSsoService {

    private final LmsSsoProperties properties;
    private final LmsSessionStore sessionStore;
    private final HttpClient httpClient;

    public LmsSsoService(LmsSsoProperties properties, LmsSessionStore sessionStore) {
        this.properties = properties;
        this.sessionStore = sessionStore;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public void authenticate(String sToken, String sIdno) {
        if (sToken == null || sToken.isBlank()) {
            throw new LmsAuthFailedException("sToken is required");
        }
        if (sIdno == null || sIdno.isBlank()) {
            throw new LmsAuthFailedException("sIdno is required");
        }

        // Phase 1: gw-cb.php → lms session cookies (in 302 Set-Cookie)
        List<String> phase1Cookies = callGwCallback(sToken, sIdno);
        if (phase1Cookies.isEmpty()) {
            throw new LmsAuthFailedException("gw-cb.php returned no Set-Cookie headers");
        }
        String lmsCookieHeader = buildCookieHeader(phase1Cookies);

        // Phase 2: canvas dashboard → canvas session cookies (xn_api_token etc.)
        List<String> phase2Cookies = fetchCanvasDashboard(lmsCookieHeader, sIdno.trim());
        String allCookies = mergeLmsCookies(lmsCookieHeader, phase2Cookies);

        sessionStore.put(sIdno.trim(), new LmsCookies(allCookies));
    }

    private List<String> callGwCallback(String sToken, String sIdno) {
        String url = properties.getGwCallbackUrl()
                + "?sToken=" + URLEncoder.encode(sToken, StandardCharsets.UTF_8)
                + "&sIdno=" + URLEncoder.encode(sIdno, StandardCharsets.UTF_8);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Cookie", "sToken=" + sToken + "; sIdno=" + sIdno)
                .timeout(properties.getTimeout())
                .GET()
                .build();
        try {
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            return response.headers().allValues("set-cookie");
        } catch (IOException exception) {
            throw new LmsAuthFailedException("gw-cb.php io error", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new LmsAuthFailedException("gw-cb.php interrupted", exception);
        }
    }

    private List<String> fetchCanvasDashboard(String lmsCookies, String studentId) {
        String url = properties.getCanvasBaseUrl()
                + "/learningx/dashboard?user_login="
                + URLEncoder.encode(studentId, StandardCharsets.UTF_8);
        String cookieHeader = lmsCookies;
        List<String> allSetCookies = new ArrayList<>();

        for (int hop = 0; hop <= 10; hop++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Cookie", cookieHeader)
                    .header("Referer", "https://lms.ssu.ac.kr/")
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .timeout(properties.getTimeout())
                    .GET()
                    .build();
            try {
                HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
                List<String> stepCookies = response.headers().allValues("set-cookie");
                allSetCookies.addAll(stepCookies);
                if (!stepCookies.isEmpty()) {
                    cookieHeader = mergeLmsCookies(cookieHeader, stepCookies);
                }

                int status = response.statusCode();
                if (status / 100 == 2) {
                    return allSetCookies;
                }
                if (status / 100 == 3) {
                    String location = response.headers().firstValue("location").orElse(null);
                    if (location == null || location.isBlank()) {
                        return allSetCookies;
                    }
                    url = URI.create(url).resolve(location).toString();
                    continue;
                }
                return allSetCookies;
            } catch (IOException exception) {
                throw new LmsAuthFailedException("canvas dashboard io error", exception);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new LmsAuthFailedException("canvas dashboard interrupted", exception);
            }
        }
        return allSetCookies;
    }

    private static String mergeLmsCookies(String base, List<String> setCookieHeaders) {
        LinkedHashMap<String, String> jar = new LinkedHashMap<>();
        if (base != null && !base.isBlank()) {
            for (String pair : base.split(";")) {
                addLmsCookiePair(jar, pair.trim());
            }
        }
        for (String setCookie : setCookieHeaders) {
            if (setCookie == null || setCookie.isBlank()) {
                continue;
            }
            int semi = setCookie.indexOf(';');
            String pair = semi < 0 ? setCookie : setCookie.substring(0, semi);
            addLmsCookiePair(jar, pair.trim());
        }
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, String> entry : jar.entrySet()) {
            if (out.length() > 0) {
                out.append("; ");
            }
            out.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return out.toString();
    }

    private static void addLmsCookiePair(LinkedHashMap<String, String> jar, String pair) {
        if (pair == null || pair.isEmpty()) {
            return;
        }
        int eq = pair.indexOf('=');
        if (eq <= 0) {
            return;
        }
        jar.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
    }

    private static String buildCookieHeader(List<String> setCookies) {
        return setCookies.stream()
                .map(LmsSsoService::stripCookieAttributes)
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("; "));
    }

    private static String stripCookieAttributes(String setCookieHeader) {
        int semicolon = setCookieHeader.indexOf(';');
        String pair = semicolon < 0 ? setCookieHeader : setCookieHeader.substring(0, semicolon);
        return pair.trim();
    }
}

package com.ssuai.domain.auth.saint;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
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
 * Confirms a SSU student's identity through the saint.ssu.ac.kr two-phase
 * handshake, modeled on {@code jonghokim27/ssutoday}'s
 * {@code AuthServiceImpl.uSaintAuth}.
 *
 * <p>Phase 1 — GET {@code saint.ssu.ac.kr/webSSO/sso.jsp?sToken=&sIdno=}
 * with the same tokens echoed in the {@code Cookie} header. saint validates
 * the one-shot tokens and, on success, responds with HTML containing
 * {@code location.href = "/irj/portal"} plus the real portal session
 * cookies in {@code Set-Cookie} headers.
 *
 * <p>Phase 2 — GET {@code saint.ssu.ac.kr/irj/portal} with the phase 1
 * cookies. saint returns the dashboard HTML; Jsoup extracts four
 * {@code main_box09_con} cells (학번 / 이름 / 소속 / 학적상태).
 *
 * <p>Security invariants:
 * <ul>
 *   <li>{@code sToken} / {@code sIdno} are method-scoped locals — never logged,
 *       persisted, or returned past this method (Task 14 spec §1, §5).
 *   <li>Phase 1 cookies are also method-scoped and discarded after phase 2.
 *       Realtime u-SAINT data tools (Task 15+) re-issue a fresh SSO flow.
 *   <li>Both upstream calls hit saint.ssu.ac.kr over HTTPS in prod; never
 *       echo the cookie or token values into responses or exceptions.
 * </ul>
 */
@Service
public class SaintSsoService {

    private static final String PHASE1_SUCCESS_MARKER = "location.href = \"/irj/portal\"";
    private static final String IDENTITY_CELL_SELECTOR = ".main_box09 .main_box09_con";
    private static final int EXPECTED_IDENTITY_CELLS = 4;

    private final SaintSsoProperties properties;
    private final RestClient restClient;

    public SaintSsoService(
            SaintSsoProperties properties,
            @Qualifier("saintSsoRestClient") RestClient restClient) {
        this.properties = properties;
        this.restClient = restClient;
    }

    public UsaintAuthResult authenticate(String sToken, String sIdno) {
        if (sToken == null || sToken.isBlank()) {
            throw new SaintAuthFailedException("sToken is required");
        }
        if (sIdno == null || sIdno.isBlank()) {
            throw new SaintAuthFailedException("sIdno is required");
        }

        ResponseEntity<String> phase1 = phase1Validate(sToken, sIdno);
        String portalCookieHeader = buildCookieHeader(phase1.getHeaders().get(HttpHeaders.SET_COOKIE));
        if (portalCookieHeader.isEmpty()) {
            throw new SaintAuthFailedException("phase 1 returned no Set-Cookie headers");
        }

        String portalHtml = phase2FetchPortal(portalCookieHeader);
        return parseIdentity(portalHtml);
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
                    .retrieve()
                    .toEntity(String.class);
        } catch (ResourceAccessException exception) {
            throw new SaintAuthFailedException("saint phase 1 timeout/io", exception);
        } catch (RestClientResponseException exception) {
            throw new SaintAuthFailedException(
                    "saint phase 1 http " + exception.getStatusCode().value(), exception);
        }

        String body = response.getBody();
        if (body == null || !body.contains(PHASE1_SUCCESS_MARKER)) {
            throw new SaintAuthFailedException("saint phase 1 success marker missing");
        }
        return response;
    }

    private String phase2FetchPortal(String portalCookieHeader) {
        try {
            return restClient.get()
                    .uri(URI.create(properties.getPortalUrl()))
                    .header(HttpHeaders.COOKIE, portalCookieHeader)
                    .retrieve()
                    .body(String.class);
        } catch (ResourceAccessException exception) {
            throw new SaintPortalUnavailableException("saint phase 2 timeout/io", exception);
        } catch (RestClientResponseException exception) {
            throw new SaintPortalUnavailableException(
                    "saint phase 2 http " + exception.getStatusCode().value(), exception);
        }
    }

    private UsaintAuthResult parseIdentity(String portalHtml) {
        if (portalHtml == null || portalHtml.isBlank()) {
            throw new SaintPortalUnavailableException("portal HTML is empty");
        }
        Document document = Jsoup.parse(portalHtml);
        Elements cells = document.select(IDENTITY_CELL_SELECTOR);
        if (cells.size() < EXPECTED_IDENTITY_CELLS) {
            throw new SaintPortalUnavailableException(
                    "portal HTML missing identity cells: got " + cells.size()
                            + ", expected " + EXPECTED_IDENTITY_CELLS);
        }
        String studentId = cells.get(0).text().trim();
        String name = cells.get(1).text().trim();
        String major = cells.get(2).text().trim();
        String enrollmentStatus = cells.get(3).text().trim();

        if (studentId.isBlank() || name.isBlank()) {
            throw new SaintPortalUnavailableException("portal HTML returned blank identity fields");
        }
        return new UsaintAuthResult(
                studentId,
                name,
                major.isBlank() ? null : major,
                enrollmentStatus.isBlank() ? null : enrollmentStatus);
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
}

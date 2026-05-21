package com.ssuai.domain.saint.connector;

import java.io.IOException;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.ssuai.domain.auth.saint.PortalCookies;
import com.ssuai.domain.auth.saint.SaintSessionStore;
import com.ssuai.domain.saint.config.SaintGradesProperties;
import com.ssuai.domain.saint.dto.CourseGrade;
import com.ssuai.domain.saint.dto.GpaSummary;
import com.ssuai.domain.saint.dto.GradesResponse;
import com.ssuai.domain.saint.dto.TermGpa;
import com.ssuai.domain.saint.service.GradesParser;
import com.ssuai.domain.saint.service.WebDynproResponseUnwrapper;
import com.ssuai.domain.saint.service.WebDynproSapEventEncoder;
import com.ssuai.global.exception.ConnectorParseException;
import com.ssuai.global.exception.ConnectorTimeoutException;
import com.ssuai.global.exception.ConnectorUnavailableException;
import com.ssuai.global.exception.SaintSessionExpiredException;

/**
 * Talks to the SAP WebDynpro {@code ZCMB3W0017} component at
 * {@code ecc.ssu.ac.kr:8443} to fetch a student's cumulative grades.
 *
 * <p>Two-step protocol (Task 16 spec §3.5.1 + §3.5.2):
 *
 * <ol>
 *   <li>{@code GET ZCMB3W0017} — the Chrome-like client receives a SAP
 *       WebDynpro JavaScript bootstrap. The connector extracts the initial
 *       {@code sap-wd-secure-id}, sends {@code Form_Request}, then unwraps
 *       the returned {@code <updates><full-update><content-update>[CDATA HTML]}
 *       envelope. Parser pulls the 학기별 GPA history table + 학적부/증명
 *       summary blocks plus the current-default-term detail rows.
 *   <li>For each prior term we still want, {@code POST ZCMB3W0017} with
 *       a {@code SAPEVENTQUEUE} that simulates pressing 이전학기
 *       ({@code WD01F0}). Each response carries a re-rendered page with
 *       the detail table populated for that hop's term. The history /
 *       summaries are unchanged across hops, so we parse them only from
 *       the first GET.
 * </ol>
 *
 * <p>Term mapping: detail rows themselves don't carry a 학기 label, so
 * the N-th prev-press response is mapped to {@code history.get(N)} —
 * mirroring the schedule connector's "WDA7 N회 후 학년도 = currentYear-N"
 * external-tracking pattern.
 *
 * <p>Partial-failure policy: if CSRF rotation breaks mid-iterate we keep
 * whatever terms we already pulled and return. Students would rather see
 * recent terms than a blank page while we investigate.
 */
@Component
@ConditionalOnProperty(name = "ssuai.connector.saint-grades", havingValue = "real")
public class RealSaintGradesConnector implements SaintGradesConnector {

    private static final Logger log = LoggerFactory.getLogger(RealSaintGradesConnector.class);

    private static final String BROWSER_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String PREV_TERM_BUTTON_ID = "WD01F0";
    private static final int MAX_PREV_HOPS = 20;
    private static final int MAX_INIT_GET_REDIRECTS = 10;

    private final SaintGradesProperties properties;
    private final HttpClient httpClient;
    private final HttpClient httpClientNoRedirect;

    @Autowired
    public RealSaintGradesConnector(SaintGradesProperties properties) {
        this(properties, defaultHttpClient(properties),
                HttpClient.newBuilder()
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .connectTimeout(properties.getTimeout())
                        .build());
    }

    RealSaintGradesConnector(SaintGradesProperties properties, HttpClient httpClient) {
        this(properties, httpClient, httpClient);
    }

    RealSaintGradesConnector(SaintGradesProperties properties,
            HttpClient httpClient, HttpClient httpClientNoRedirect) {
        this.properties = properties;
        this.httpClient = httpClient;
        this.httpClientNoRedirect = httpClientNoRedirect;
    }

    private record InitGetResult(String html, String cookieHeader, String finalUrl) {}

    private CookieManager createCookieManager(String rawCookieHeader, String targetUrl) {
        CookieManager cookieManager = new CookieManager();
        if (rawCookieHeader == null || rawCookieHeader.isBlank()) {
            return cookieManager;
        }
        URI targetUri = URI.create(targetUrl);
        String host = targetUri.getHost();
        String cookieDomain = (host != null && host.endsWith("ssu.ac.kr")) ? ".ssu.ac.kr" : host;

        for (String pair : rawCookieHeader.split(";")) {
            String trimmed = pair.trim();
            int eq = trimmed.indexOf('=');
            if (eq > 0) {
                String name = trimmed.substring(0, eq).trim();
                String value = trimmed.substring(eq + 1).trim();
                if (!name.isEmpty()) {
                    if ("MYSAPSSO2".equals(name) || "sToken".equals(name) || "WAF".equals(name)) {
                        HttpCookie cookie = new HttpCookie(name, value);
                        if (cookieDomain != null) {
                            cookie.setDomain(cookieDomain);
                        }
                        cookie.setPath("/");
                        cookie.setVersion(0);
                        cookieManager.getCookieStore().add(targetUri, cookie);
                    }
                }
            }
        }
        return cookieManager;
    }

    @Override
    public GradesResponse fetchGrades(String studentId, PortalCookies cookies) {
        CookieManager cookieManager = createCookieManager(cookies.rawCookieHeader(), properties.getGradesUrl());
        HttpClient.Redirect initRedirectPolicy = httpClient.followRedirects();
        HttpClient client = HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .followRedirects(initRedirectPolicy)
                .connectTimeout(properties.getTimeout())
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(properties.getGradesUrl()))
                .header("Accept", "text/html,application/xhtml+xml")
                .header("Accept-Language", "ko")
                .header("User-Agent", BROWSER_UA)
                .timeout(properties.getTimeout())
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (java.net.http.HttpTimeoutException e) {
            throw new ConnectorTimeoutException(e);
        } catch (IOException e) {
            log.warn("saint grades connector IOException on GET", e);
            throw new ConnectorUnavailableException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ConnectorUnavailableException(e);
        }

        int status = response.statusCode();
        if (status / 100 != 2) {
            log.warn("saint grades connector unexpected status on GET: status={}", status);
            throw new ConnectorUnavailableException();
        }

        String rawFirstResponse = response.body();
        String finalUrl = response.uri().toString();
        Map<String, String> bootstrapFormFields = hiddenFormFields(rawFirstResponse);

        String actionRaw = extractFormActionUrl(rawFirstResponse, finalUrl);
        String postUrl;
        if (actionRaw.startsWith("http")) {
            postUrl = actionRaw;
        } else {
            URI base = URI.create(finalUrl);
            postUrl = base.getScheme() + "://" + base.getAuthority() + actionRaw;
        }
        log.info("saint grades init POST url='{}'", postUrl);

        Optional<String> bootstrapSecureId = WebDynproResponseUnwrapper.extractSecureIdFromAny(rawFirstResponse);
        log.info("saint grades bootstrap: secureIdPresent={} snippet='{}'",
                bootstrapSecureId.isPresent(),
                rawFirstResponse == null ? "(null)"
                        : rawFirstResponse.substring(0, Math.min(300, rawFirstResponse.length()))
                                .replaceAll("\\s+", " "));
        if (bootstrapSecureId.isEmpty()) {
            String snippet = rawFirstResponse == null ? "(null)"
                    : rawFirstResponse.substring(0, Math.min(300, rawFirstResponse.length())).replaceAll("\\s+", " ");
            log.info("saint grades bootstrap no secure-id: studentFp={} snippet='{}'",
                    SaintSessionStore.fingerprint(studentId), snippet);
            throw new SaintSessionExpiredException("ecc did not provide sap-wd-secure-id on first GET");
        }

        String firstHtml = firstRenderableHtml(rawFirstResponse);
        if (!containsGradesTables(firstHtml)) {
            String initXml = httpPostInitialLoad(client, bootstrapSecureId.get(), "ZCMB3W0017",
                    finalUrl, postUrl, bootstrapFormFields);
            try {
                firstHtml = WebDynproResponseUnwrapper.extractHtml(initXml);
            } catch (IllegalArgumentException ex) {
                log.info("saint grades init POST non-wrapper: studentFp={}",
                        SaintSessionStore.fingerprint(studentId));
                throw new SaintSessionExpiredException("ecc init POST did not return expected XML wrapper");
            }
        }
        guardAuthOrThrow(firstHtml, studentId);

        Optional<String> secureId = WebDynproResponseUnwrapper.extractSecureId(firstHtml);

        List<TermGpa> history = GradesParser.parseTermHistory(firstHtml);
        GpaSummary academicRecord = GradesParser.parseAcademicSummary(firstHtml);
        GpaSummary certificate = GradesParser.parseCertificateSummary(firstHtml);

        Map<String, List<CourseGrade>> details = new LinkedHashMap<>();
        if (!history.isEmpty()) {
            List<CourseGrade> defaultDetails = GradesParser.parseDetailRows(firstHtml);
            if (!defaultDetails.isEmpty()) {
                details.put(history.get(0).termKey(), defaultDetails);
            }
        }

        int hops = 0;
        for (int i = 1; i < history.size() && hops < MAX_PREV_HOPS; i++) {
            if (secureId.isEmpty()) {
                log.warn("saint grades iterate halted: studentFp={} reason=missing-secure-id index={}",
                        SaintSessionStore.fingerprint(studentId), i);
                break;
            }
            String xmlEnvelope;
            try {
                xmlEnvelope = httpPostButtonPress(client, secureId.get(),
                        PREV_TERM_BUTTON_ID, postUrl, bootstrapFormFields);
            } catch (SaintSessionExpiredException exception) {
                log.info("saint grades iterate halted: studentFp={} reason=session-expired index={}",
                        SaintSessionStore.fingerprint(studentId), i);
                break;
            }
            String prevHtml;
            try {
                prevHtml = WebDynproResponseUnwrapper.extractHtml(xmlEnvelope);
            } catch (IllegalArgumentException exception) {
                log.warn("saint grades iterate halted: studentFp={} reason=non-wrapper-response index={}",
                        SaintSessionStore.fingerprint(studentId), i);
                break;
            }
            secureId = WebDynproResponseUnwrapper.extractSecureId(prevHtml);
            List<CourseGrade> rows = GradesParser.parseDetailRows(prevHtml);
            if (!rows.isEmpty()) {
                details.put(history.get(i).termKey(), rows);
            }
            hops++;
        }
        log.info("saint grades fetched: studentFp={} history={} detailTerms={} hops={}",
                SaintSessionStore.fingerprint(studentId), history.size(), details.size(), hops);
        return new GradesResponse(history, academicRecord, certificate, details);
    }

    private InitGetResult httpGetFollowCookies(String startCookieHeader, String startUrl, String logPrefix) {
        String cookieHeader = startCookieHeader;
        String url = startUrl;
        for (int hop = 0; hop <= MAX_INIT_GET_REDIRECTS; hop++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Cookie", cookieHeader)
                    .header("Accept", "text/html,application/xhtml+xml")
                    .header("Accept-Language", "ko")
                    .header("User-Agent", BROWSER_UA)
                    .timeout(properties.getTimeout())
                    .GET()
                    .build();
            HttpResponse<String> response;
            try {
                response = httpClientNoRedirect.send(request,
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            } catch (java.net.http.HttpTimeoutException e) {
                throw new ConnectorTimeoutException(e);
            } catch (IOException e) {
                log.warn("{} connector IOException on GET", logPrefix, e);
                throw new ConnectorUnavailableException(e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ConnectorUnavailableException(e);
            }
            cookieHeader = mergeSetCookies(cookieHeader, response.headers().allValues("Set-Cookie"));
            int status = response.statusCode();
            if (status / 100 == 3) {
                String location = response.headers().firstValue("Location").orElse(null);
                if (location == null) {
                    log.warn("{} connector redirect missing Location: status={}", logPrefix, status);
                    throw new ConnectorUnavailableException();
                }
                if (!location.startsWith("http")) {
                    URI base = URI.create(url);
                    location = base.getScheme() + "://" + base.getAuthority() + location;
                }
                url = location;
                continue;
            }
            if (status / 100 == 2) {
                log.info("{} connector GET final: status={} url={} cookieNames={}",
                        logPrefix, status, url, cookieNames(cookieHeader));
                return new InitGetResult(response.body(), cookieHeader, url);
            }
            if (status / 100 == 5) {
                log.warn("{} connector 5xx on GET: status={}", logPrefix, status);
                throw new ConnectorUnavailableException();
            }
            log.warn("{} connector unexpected status on GET: status={}", logPrefix, status);
            throw new ConnectorUnavailableException();
        }
        log.warn("{} connector too many redirects on GET", logPrefix);
        throw new ConnectorUnavailableException();
    }

    private String httpPostInitialLoad(
            HttpClient client, String secureId, String appName,
            String pageUrl, String postUrl, Map<String, String> formFields) {
        String queue = WebDynproSapEventEncoder.encodeInitialLoad(pageUrl);
        String body = formEncoded(webDynproForm(formFields, secureId, appName, queue));
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(postUrl))
                .header("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
                .header("Accept", "application/xml,text/html")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("X-XHR-Logon", "accept")
                .header("User-Agent", BROWSER_UA)
                .timeout(properties.getTimeout())
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        return send(client, request).body();
    }

    private String httpPostButtonPress(
            HttpClient client, String secureId, String buttonId, String postUrl, Map<String, String> formFields) {
        String queue = WebDynproSapEventEncoder.encodeButtonPress(buttonId, postUrl);
        String body = formEncoded(webDynproForm(formFields, secureId, "ZCMB3W0017", queue));
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(postUrl))
                .header("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
                .header("Accept", "application/xml,text/html")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("X-XHR-Logon", "accept")
                .header("User-Agent", BROWSER_UA)
                .timeout(properties.getTimeout())
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        return send(client, request).body();
    }

    private HttpResponse<String> send(HttpClient client, HttpRequest request) {
        try {
            HttpResponse<String> response = client.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            if (status / 100 == 2) {
                return response;
            }
            if (status == 401 || status == 403) {
                String bodySnippet4xx = response.body() == null ? "(null)"
                        : response.body().substring(0, Math.min(400, response.body().length()))
                                .replaceAll("\\s+", " ");
                log.info("saint grades connector auth rejected: status={} body='{}'", status, bodySnippet4xx);
                throw new SaintSessionExpiredException("ecc rejected WebDynpro request with " + status);
            }
            if (status / 100 == 5) {
                String snippet = response.body() == null ? "(null)"
                        : response.body().substring(0, Math.min(300, response.body().length()));
                log.warn("saint grades connector 5xx: status={} body='{}'", status, snippet);
                throw new ConnectorUnavailableException();
            }
            String body4xx = response.body() == null ? "(null)"
                    : response.body().substring(0, Math.min(500, response.body().length())).replaceAll("\\s+", " ");
            log.warn("saint grades connector unexpected status={} body='{}'", status, body4xx);
            throw new ConnectorParseException();
        } catch (java.net.http.HttpTimeoutException exception) {
            throw new ConnectorTimeoutException(exception);
        } catch (IOException exception) {
            log.warn("saint grades connector IOException", exception);
            throw new ConnectorUnavailableException(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ConnectorUnavailableException(exception);
        }
    }

    private void guardAuthOrThrow(String html, String studentId) {
        if (html == null || html.isBlank()) {
            throw new SaintSessionExpiredException("ecc returned empty body");
        }
        if (!containsGradesTables(html)) {
            String snippet = html.substring(0, Math.min(500, html.length())).replaceAll("\\s+", " ");
            log.info("saint grades auth gate tripped: studentFp={} htmlSnippet='{}'",
                    SaintSessionStore.fingerprint(studentId), snippet);
            throw new SaintSessionExpiredException(
                    "ecc did not return the grades tables (likely logon redirect)");
        }
    }

    private static String firstRenderableHtml(String responseBody) {
        try {
            return WebDynproResponseUnwrapper.extractHtml(responseBody);
        } catch (IllegalArgumentException ignored) {
            return responseBody;
        }
    }

    private static boolean containsGradesTables(String html) {
        return html != null && !html.isBlank()
                && org.jsoup.Jsoup.parse(html).selectFirst("tbody[id$=-contentTBody]") != null;
    }

    static String mergeSetCookies(String existing, List<String> setCookieHeaders) {
        LinkedHashMap<String, String> jar = new LinkedHashMap<>();
        if (existing != null && !existing.isBlank()) {
            for (String pair : existing.split(";")) {
                addPair(jar, pair.trim());
            }
        }
        if (setCookieHeaders != null) {
            for (String setCookie : setCookieHeaders) {
                if (setCookie == null || setCookie.isBlank()) {
                    continue;
                }
                int semi = setCookie.indexOf(';');
                String pair = semi < 0 ? setCookie : setCookie.substring(0, semi);
                addPair(jar, pair.trim());
            }
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

    static String eccBootstrapCookieHeader(String portalCookieHeader) {
        if (portalCookieHeader == null || portalCookieHeader.isBlank()) {
            return "";
        }
        List<String> preserved = new ArrayList<>();
        for (String pair : portalCookieHeader.split(";")) {
            String trimmed = pair.trim();
            int eq = trimmed.indexOf('=');
            if (eq > 0) {
                String name = trimmed.substring(0, eq).trim();
                if ("MYSAPSSO2".equals(name) || "WAF".equals(name)) {
                    preserved.add(trimmed);
                }
            }
        }
        return String.join("; ", preserved);
    }

    private static String cookieNames(String cookieHeader) {
        if (cookieHeader == null || cookieHeader.isBlank()) {
            return "(none)";
        }
        List<String> names = new ArrayList<>();
        for (String pair : cookieHeader.split(";")) {
            String trimmed = pair.trim();
            int eq = trimmed.indexOf('=');
            if (eq > 0) {
                names.add(trimmed.substring(0, eq).trim());
            }
        }
        return String.join(",", names);
    }

    private static void addPair(LinkedHashMap<String, String> jar, String pair) {
        if (pair == null || pair.isEmpty()) {
            return;
        }
        int eq = pair.indexOf('=');
        if (eq <= 0) {
            return;
        }
        String name = pair.substring(0, eq).trim();
        String value = pair.substring(eq + 1).trim();
        if (name.isEmpty()) {
            return;
        }
        jar.put(name, value);
    }

    private static String formEncoded(Map<String, String> form) {
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, String> entry : form.entrySet()) {
            if (out.length() > 0) {
                out.append('&');
            }
            out.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append('=')
                    .append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return out.toString();
    }

    private static Map<String, String> hiddenFormFields(String html) {
        LinkedHashMap<String, String> fields = new LinkedHashMap<>();
        if (html == null || html.isBlank()) {
            return fields;
        }
        org.jsoup.Jsoup.parse(html).select("input[name]").forEach(input -> {
            String name = input.attr("name");
            if (!name.isBlank()) {
                fields.put(name, input.attr("value"));
            }
        });
        return fields;
    }

    private static String extractFormActionUrl(String bootstrapHtml, String fallbackUrl) {
        if (bootstrapHtml == null || bootstrapHtml.isBlank()) return fallbackUrl;
        var form = org.jsoup.Jsoup.parse(bootstrapHtml).selectFirst("form[id=sap.client.SsrClient.form]");
        if (form == null) return fallbackUrl;
        String action = form.attr("action");
        if (action == null || action.isBlank()) return fallbackUrl;
        return action;
    }

    private static Map<String, String> webDynproForm(
            Map<String, String> formFields, String secureId, String appName, String queue) {
        LinkedHashMap<String, String> form = new LinkedHashMap<>();
        if (formFields != null) {
            formFields.forEach((key, value) -> {
                if (!"sap-wd-cltwndid".equals(key)) {
                    form.put(key, value);
                }
            });
        }
        form.put("sap-charset", "utf-8");
        form.put("sap-wd-secure-id", secureId);
        form.put("fesrAppName", appName);
        form.put("fesrUseBeacon", "true");
        form.put("SAPEVENTQUEUE", queue);
        return form;
    }

    private static HttpClient defaultHttpClient(SaintGradesProperties properties) {
        return HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(properties.getTimeout())
                .build();
    }
}

package com.ssuai.domain.saint.connector;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Document;
import org.jsoup.parser.Parser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.ssuai.global.exception.ConnectorTimeoutException;
import com.ssuai.global.exception.ConnectorUnavailableException;

/**
 * Resolves the SAP WebDynpro ECC entry URL from the authenticated SAINT portal.
 *
 * <p>The important part is the portal-issued path matrix parameter
 * ({@code ;sap-ext-sid=...}). It is session material, so this class never logs
 * the resolved URL or the portal HTML body.
 */
public class PortalNavigationService {

    private static final Logger log = LoggerFactory.getLogger(PortalNavigationService.class);

    private static final String BROWSER_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String SAINT_ORIGIN = "https://saint.ssu.ac.kr";
    private static final String SAINT_REFERER = SAINT_ORIGIN + "/";
    private static final String SAP_PATH_PREFIX = "/sap/bc/webdynpro/SAP/";
    private static final Pattern URL_CANDIDATE = Pattern.compile(
            "(https?(?:://|:\\\\/\\\\/)[^\\s\"'<>]+|"
                    + "/sap/bc/webdynpro/SAP/[^\\s\"'<>]+|"
                    + "\\b[A-Z0-9_]{5,}(?:;[^\\s\"'<>]+)?(?:\\?[^\\s\"'<>]+)?)",
            Pattern.CASE_INSENSITIVE);

    private final String portalUrl;
    private final Duration timeout;

    public PortalNavigationService(String portalUrl, Duration timeout) {
        this.portalUrl = portalUrl == null ? "" : portalUrl.trim();
        this.timeout = timeout == null ? Duration.ofSeconds(10) : timeout;
    }

    public Optional<EccEntryPoint> resolveEntryPoint(HttpClient client, String appName, String fallbackUrl) {
        if (portalUrl.isBlank()) {
            return Optional.empty();
        }
        String portalHtml = fetchPortal(client);
        Optional<String> entryUrl = extractEntryUrl(portalHtml, appName, fallbackUrl);
        log.info("saint portal navigation: app={} entryUrlPresent={} sapExtSidPresent={} bodyBytes={}",
                appName, entryUrl.isPresent(), entryUrl.map(url -> url.contains(";sap-ext-sid=")).orElse(false),
                portalHtml == null ? 0 : portalHtml.getBytes(StandardCharsets.UTF_8).length);
        return entryUrl.map(EccEntryPoint::new);
    }

    private String fetchPortal(HttpClient client) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(portalUrl))
                .header("Accept", "text/html,application/xhtml+xml")
                .header("Accept-Language", "ko")
                .header("User-Agent", BROWSER_UA)
                .timeout(timeout)
                .GET()
                .build();
        try {
            HttpResponse<String> response = client.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            if (status / 100 == 2) {
                return response.body();
            }
            log.warn("saint portal navigation failed: status={}", status);
            throw new ConnectorUnavailableException();
        } catch (java.net.http.HttpTimeoutException exception) {
            throw new ConnectorTimeoutException(exception);
        } catch (IOException exception) {
            log.warn("saint portal navigation IOException", exception);
            throw new ConnectorUnavailableException(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ConnectorUnavailableException(exception);
        }
    }

    static Optional<String> extractEntryUrl(String portalHtml, String appName, String fallbackUrl) {
        if (portalHtml == null || portalHtml.isBlank() || appName == null || appName.isBlank()) {
            return Optional.empty();
        }
        List<String> candidates = new ArrayList<>();
        Document document = Jsoup.parse(portalHtml, "", Parser.htmlParser());
        document.getAllElements().forEach(element -> {
            for (Attribute attribute : element.attributes()) {
                String value = attribute.getValue();
                if (value != null && value.contains(appName)) {
                    candidates.add(value);
                }
            }
        });

        Matcher matcher = URL_CANDIDATE.matcher(portalHtml);
        while (matcher.find()) {
            String candidate = matcher.group(1);
            if (candidate != null && candidate.contains(appName)) {
                candidates.add(candidate);
            }
        }

        return candidates.stream()
                .map(PortalNavigationService::cleanCandidate)
                .filter(candidate -> isAppEntryCandidate(candidate, appName))
                .distinct()
                .sorted(Comparator.comparingInt(PortalNavigationService::candidateScore).reversed())
                .map(candidate -> normalizeEntryUrl(candidate, appName, fallbackUrl))
                .flatMap(Optional::stream)
                .findFirst();
    }

    private static boolean isAppEntryCandidate(String candidate, String appName) {
        if (candidate == null || candidate.isBlank() || !candidate.contains(appName)) {
            return false;
        }
        return candidate.contains(SAP_PATH_PREFIX)
                || candidate.startsWith(appName)
                || candidate.contains("/" + appName)
                || candidate.contains("SAP/" + appName);
    }

    private static int candidateScore(String candidate) {
        int score = 0;
        if (candidate.contains(";sap-ext-sid=")) score += 100;
        if (candidate.contains(":8443")) score += 20;
        if (candidate.startsWith("https://")) score += 10;
        if (candidate.contains(SAP_PATH_PREFIX)) score += 5;
        return score;
    }

    private static Optional<String> normalizeEntryUrl(String candidate, String appName, String fallbackUrl) {
        try {
            URI fallback = URI.create(fallbackUrl);
            URI normalized;
            if (candidate.startsWith("//")) {
                normalized = URI.create("https:" + candidate);
            } else if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
                normalized = URI.create(candidate);
            } else if (candidate.startsWith("/")) {
                normalized = origin(fallback).resolve(candidate);
            } else {
                String suffix = candidate.startsWith("SAP/") ? candidate.substring("SAP/".length()) : candidate;
                if (!suffix.startsWith(appName)) {
                    int appIndex = suffix.indexOf(appName);
                    if (appIndex >= 0) {
                        suffix = suffix.substring(appIndex);
                    }
                }
                normalized = origin(fallback).resolve(sapBasePath(fallback) + suffix);
            }
            normalized = forceEcc8443(normalized);
            return Optional.of(normalized.toString());
        } catch (IllegalArgumentException | URISyntaxException exception) {
            return Optional.empty();
        }
    }

    private static URI origin(URI uri) throws URISyntaxException {
        return new URI(uri.getScheme(), uri.getUserInfo(), uri.getHost(), uri.getPort(), "/", null, null);
    }

    private static String sapBasePath(URI fallback) {
        String path = fallback.getPath();
        int marker = path == null ? -1 : path.indexOf(SAP_PATH_PREFIX);
        if (marker >= 0) {
            return path.substring(0, marker + SAP_PATH_PREFIX.length());
        }
        return SAP_PATH_PREFIX;
    }

    private static URI forceEcc8443(URI uri) throws URISyntaxException {
        if (!"ecc.ssu.ac.kr".equalsIgnoreCase(uri.getHost()) || uri.getPort() == 8443) {
            return uri;
        }
        return new URI(uri.getScheme(), uri.getUserInfo(), uri.getHost(), 8443,
                uri.getPath(), uri.getQuery(), uri.getFragment());
    }

    private static String cleanCandidate(String raw) {
        String value = Parser.unescapeEntities(raw, true).trim()
                .replace("\\/", "/")
                .replace("\\x3a", ":")
                .replace("\\x3A", ":")
                .replace("\\u003a", ":")
                .replace("\\u003A", ":")
                .replace("\\x2f", "/")
                .replace("\\x2F", "/")
                .replace("\\u002f", "/")
                .replace("\\u002F", "/")
                .replace("\\u003d", "=")
                .replace("\\u003D", "=")
                .replace("\\x3d", "=")
                .replace("\\x3D", "=");
        while (!value.isEmpty() && ")]};,.".indexOf(value.charAt(value.length() - 1)) >= 0) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    public record EccEntryPoint(String url) {
        public EccEntryPoint {
            if (url == null || url.isBlank()) {
                throw new IllegalArgumentException("url is required");
            }
        }
    }

    static String saintReferer() {
        return SAINT_REFERER;
    }

    static String saintOrigin() {
        return SAINT_ORIGIN;
    }
}

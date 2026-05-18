package com.ssuai.domain.auth.saint;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.ssuai.global.exception.SaintAuthFailedException;
import com.ssuai.global.exception.SaintPortalUnavailableException;

class SaintSsoServiceTests {

    private static final String SSO_URL = "https://saint.test.local/webSSO/sso.jsp";
    private static final Instant T0 = Instant.parse("2026-05-16T10:00:00Z");
    private static final org.springframework.http.MediaType TEXT_HTML_UTF8 =
            org.springframework.http.MediaType.parseMediaType("text/html;charset=UTF-8");

    private SaintSsoProperties properties;
    private MockRestServiceServer mockServer;
    private MockWebServer phase2Server;
    private SaintSessionStore sessionStore;
    private SaintSsoService service;

    @BeforeEach
    void setUp() throws IOException {
        phase2Server = new MockWebServer();
        phase2Server.start();

        properties = new SaintSsoProperties();
        properties.setSsoUrl(SSO_URL);
        properties.setPortalUrl(phase2Server.url("/irj/portal").toString());
        properties.setTimeout(Duration.ofSeconds(2));

        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();

        SaintSessionProperties sessionProps = new SaintSessionProperties();
        sessionProps.setTtl(Duration.ofMinutes(30));
        sessionProps.setEncryptionKey("");
        sessionStore = new SaintSessionStore(
                sessionProps, Clock.fixed(T0, ZoneOffset.UTC), new SecureRandom());

        HttpClient httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();

        service = new SaintSsoService(properties, restClient, sessionStore, httpClient);
    }

    @AfterEach
    void tearDown() throws IOException {
        phase2Server.shutdown();
    }

    @Test
    void happyPathParsesIdentityAndForwardsPortalCookies() {
        HttpHeaders phase1Headers = new HttpHeaders();
        phase1Headers.setContentType(TEXT_HTML_UTF8);
        phase1Headers.add(HttpHeaders.SET_COOKIE,
                "MYSAPSSO2=portal-session-abc; Path=/; HttpOnly");
        phase1Headers.add(HttpHeaders.SET_COOKIE,
                "JSESSIONID=jsess-xyz; Path=/irj");

        mockServer.expect(requestTo(phase1Uri("sToken-one-shot", "20231234")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.COOKIE, "sToken=sToken-one-shot; sIdno=20231234"))
                .andRespond(withSuccess(loadFixture("saint/phase1-success.html"),
                        TEXT_HTML_UTF8).headers(phase1Headers));

        // Phase 2: direct 200, no redirects, no extra Set-Cookie
        phase2Server.enqueue(new MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/html;charset=UTF-8")
                .setBody(loadFixture("saint/portal-success.html")));

        UsaintAuthResult result = service.authenticate("sToken-one-shot", "20231234");

        assertThat(result.studentId()).isEqualTo("20231234");
        assertThat(result.name()).isEqualTo("홍길동");
        assertThat(result.major()).isNull();
        assertThat(result.enrollmentStatus()).isNull();
        assertThat(sessionStore.cookies("20231234"))
                .as("phase 1 portal cookies should be persisted under the sIdno-derived studentId")
                .hasValueSatisfying(cookies -> assertThat(cookies.rawCookieHeader())
                        .isEqualTo("MYSAPSSO2=portal-session-abc; JSESSIONID=jsess-xyz"));
        mockServer.verify();
    }

    @Test
    void phase2RedirectSetCookiesOverridePhase1Mysapsso2() {
        // The real SAP portal sends the authoritative MYSAPSSO2 on the initial 302.
        // This test verifies that the redirect cookie wins over the phase-1 value.
        HttpHeaders phase1Headers = new HttpHeaders();
        phase1Headers.add(HttpHeaders.SET_COOKIE, "MYSAPSSO2=old-from-sso-jsp; Path=/");
        phase1Headers.add(HttpHeaders.SET_COOKIE, "JSESSIONID=jsess-123; Path=/irj");

        mockServer.expect(requestTo(phase1Uri("tok", "20231234")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(loadFixture("saint/phase1-success.html"),
                        TEXT_HTML_UTF8).headers(phase1Headers));

        // Phase 2: 302 with fresh MYSAPSSO2, then 200 with portal HTML
        phase2Server.enqueue(new MockResponse()
                .setResponseCode(302)
                .addHeader("Location", "/irj/portal/final")
                .addHeader("Set-Cookie", "MYSAPSSO2=fresh-from-portal; Path=/; HttpOnly"));
        phase2Server.enqueue(new MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/html;charset=UTF-8")
                .setBody(loadFixture("saint/portal-success.html")));

        service.authenticate("tok", "20231234");

        assertThat(sessionStore.cookies("20231234"))
                .hasValueSatisfying(cookies -> {
                    String h = cookies.rawCookieHeader();
                    assertThat(h).contains("MYSAPSSO2=fresh-from-portal");
                    assertThat(h).contains("JSESSIONID=jsess-123");
                    assertThat(h).doesNotContain("old-from-sso-jsp");
                });
        mockServer.verify();
    }

    @Test
    void phase1SuccessMarkerMissingFailsAuth() {
        mockServer.expect(requestTo(phase1Uri("bad", "20231234")))
                .andRespond(withSuccess(loadFixture("saint/phase1-failure.html"),
                        TEXT_HTML_UTF8));

        assertThatThrownBy(() -> service.authenticate("bad", "20231234"))
                .isInstanceOf(SaintAuthFailedException.class)
                .hasMessageContaining("success marker");
        assertThat(sessionStore.size())
                .as("no cookies should be persisted when phase 1 fails")
                .isZero();
    }

    @Test
    void phase1ServerErrorFailsAuth() {
        mockServer.expect(requestTo(phase1Uri("token", "20231234")))
                .andRespond(withServerError());

        assertThatThrownBy(() -> service.authenticate("token", "20231234"))
                .isInstanceOf(SaintAuthFailedException.class)
                .hasMessageContaining("http 500");
    }

    @Test
    void phase1WithoutSetCookieFailsAuth() {
        mockServer.expect(requestTo(phase1Uri("token", "20231234")))
                .andRespond(withSuccess(loadFixture("saint/phase1-success.html"),
                        TEXT_HTML_UTF8));

        assertThatThrownBy(() -> service.authenticate("token", "20231234"))
                .isInstanceOf(SaintAuthFailedException.class)
                .hasMessageContaining("Set-Cookie");
    }

    @Test
    void phase2PortalParseFailsWhenGreetingSuffixIsUnknown() {
        HttpHeaders phase1Headers = new HttpHeaders();
        phase1Headers.add(HttpHeaders.SET_COOKIE, "MYSAPSSO2=cookie; Path=/");

        mockServer.expect(requestTo(phase1Uri("token", "20231234")))
                .andRespond(withSuccess(loadFixture("saint/phase1-success.html"),
                        TEXT_HTML_UTF8).headers(phase1Headers));

        phase2Server.enqueue(new MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/html;charset=UTF-8")
                .setBody(loadFixture("saint/portal-greeting-unknown-suffix.html")));

        assertThatThrownBy(() -> service.authenticate("token", "20231234"))
                .isInstanceOf(SaintPortalUnavailableException.class)
                .hasMessageContaining("did not match any known name suffix");
        assertThat(sessionStore.size())
                .as("no cookies should be persisted when the greeting suffix is unrecognized")
                .isZero();
    }

    @Test
    void phase2PortalParseFailsWhenGreetingElementIsMissing() {
        HttpHeaders phase1Headers = new HttpHeaders();
        phase1Headers.add(HttpHeaders.SET_COOKIE, "MYSAPSSO2=cookie; Path=/");

        mockServer.expect(requestTo(phase1Uri("token", "20231234")))
                .andRespond(withSuccess(loadFixture("saint/phase1-success.html"),
                        TEXT_HTML_UTF8).headers(phase1Headers));

        phase2Server.enqueue(new MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/html;charset=UTF-8")
                .setBody(loadFixture("saint/portal-missing-name.html")));

        assertThatThrownBy(() -> service.authenticate("token", "20231234"))
                .isInstanceOf(SaintPortalUnavailableException.class)
                .hasMessageContaining("missing greeting element");
        assertThat(sessionStore.size())
                .as("no cookies should be persisted when the greeting span is missing")
                .isZero();
    }

    @Test
    void phase2ServerErrorMapsToPortalUnavailable() {
        HttpHeaders phase1Headers = new HttpHeaders();
        phase1Headers.add(HttpHeaders.SET_COOKIE, "MYSAPSSO2=cookie; Path=/");

        mockServer.expect(requestTo(phase1Uri("token", "20231234")))
                .andRespond(withSuccess(loadFixture("saint/phase1-success.html"),
                        TEXT_HTML_UTF8).headers(phase1Headers));

        phase2Server.enqueue(new MockResponse().setResponseCode(502));

        assertThatThrownBy(() -> service.authenticate("token", "20231234"))
                .isInstanceOf(SaintPortalUnavailableException.class)
                .hasMessageContaining("http 502");
    }

    @Test
    void blankInputIsRejectedBeforeAnyUpstreamCall() {
        assertThatThrownBy(() -> service.authenticate("  ", "20231234"))
                .isInstanceOf(SaintAuthFailedException.class)
                .hasMessageContaining("sToken");
        assertThatThrownBy(() -> service.authenticate("token", null))
                .isInstanceOf(SaintAuthFailedException.class)
                .hasMessageContaining("sIdno");
        mockServer.verify();
    }

    private static String phase1Uri(String sToken, String sIdno) {
        return SSO_URL
                + "?sToken=" + URLEncoder.encode(sToken, StandardCharsets.UTF_8)
                + "&sIdno=" + URLEncoder.encode(sIdno, StandardCharsets.UTF_8);
    }

    private static String loadFixture(String classpath) {
        try {
            return new String(new ClassPathResource(classpath).getInputStream().readAllBytes(),
                    StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}

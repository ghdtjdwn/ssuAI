package com.ssuai.domain.saint.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssuai.domain.auth.saint.PortalCookies;
import com.ssuai.domain.saint.config.SaintScheduleProperties;
import com.ssuai.domain.saint.dto.ScheduleResponse;
import com.ssuai.global.exception.SaintSessionExpiredException;

class RealSaintScheduleConnectorTests {

    private static final Clock CLOCK_2026_05_16 = Clock.fixed(
            Instant.parse("2026-05-16T03:00:00Z"), ZoneOffset.UTC);

    private MockWebServer server;
    private RealSaintScheduleConnector connector;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        SaintScheduleProperties properties = new SaintScheduleProperties();
        properties.setTimetableUrl(server.url("/zcmw2102").toString());
        properties.setTimeout(Duration.ofSeconds(5));
        HttpClient httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        connector = new RealSaintScheduleConnector(properties, CLOCK_2026_05_16, httpClient);
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void enrollmentAlreadyAtCurrentTermDoesOneGetAndZeroPosts() throws Exception {
        // pinned fixture shows (2026, 1학기). Student enrolled 2026-1학기 →
        // displayedTerm already at the enrollment-start anchor → no PREV
        // POST needed.
        server.enqueue(htmlOk(loadFixture()));

        ScheduleResponse response = connector.fetchSchedule("20261234",
                new PortalCookies("MYSAPSSO2=abc"));

        assertThat(response.enrollmentYear()).isEqualTo(2026);
        assertThat(response.currentYear()).isEqualTo(2026);
        assertThat(response.currentTerm()).isEqualTo(1);
        assertThat(response.terms()).hasSize(1);
        assertThat(response.terms().get(0).entries()).hasSize(7);
        assertThat(server.getRequestCount()).isEqualTo(1);

        RecordedRequest first = server.takeRequest();
        assertThat(first.getMethod()).isEqualTo("GET");
        assertThat(first.getHeader("Cookie")).contains("MYSAPSSO2=abc");
    }

    @Test
    void multiTermIteratePostsPrevButtonPerStepAndLabelsEachHopFromTheResponse() throws Exception {
        // Construct a 4-step iterate. GET sits at (2026, 1학기) → PREV →
        // (2025, 4=겨울) → PREV → (2025, 3=2학기) → PREV → (2025, 2=여름)
        // → PREV → (2025, 1=1학기). Student enrolled 2025-1학기 → stop.
        String getBody = withSecureId(synthFixture(2026, "1학기"), "CSRF-0");
        String postWinter2025 = wrap(withSecureId(synthFixture(2025, "겨울학기"), "CSRF-1"));
        String postFall2025 = wrap(withSecureId(synthFixture(2025, "2학기"), "CSRF-2"));
        String postSummer2025 = wrap(withSecureId(synthFixture(2025, "여름학기"), "CSRF-3"));
        String postSpring2025 = wrap(synthFixture(2025, "1학기"));

        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .addHeader("Set-Cookie", "SAP_SESSIONID_SSP_100=ABCD; Path=/")
                .setBody(getBody));
        server.enqueue(xmlOk(postWinter2025));
        server.enqueue(xmlOk(postFall2025));
        server.enqueue(xmlOk(postSummer2025));
        server.enqueue(xmlOk(postSpring2025));

        ScheduleResponse response = connector.fetchSchedule("20251234",
                new PortalCookies("MYSAPSSO2=abc"));

        // GET + 4 PREV POSTs = 5 server hits / 5 terms.
        assertThat(server.getRequestCount()).isEqualTo(5);
        assertThat(response.terms()).hasSize(5);
        // First entry is the GET-displayed term.
        assertThat(response.terms().get(0).year()).isEqualTo(2026);
        assertThat(response.terms().get(0).term()).isEqualTo(1);
        // Each subsequent entry came from parsing the POST response — not
        // from a clock-based calculation — so the cycle order is exact.
        assertThat(response.terms().get(1).year()).isEqualTo(2025);
        assertThat(response.terms().get(1).term()).isEqualTo(4);
        assertThat(response.terms().get(2).term()).isEqualTo(3);
        assertThat(response.terms().get(3).term()).isEqualTo(2);
        assertThat(response.terms().get(4).year()).isEqualTo(2025);
        assertThat(response.terms().get(4).term()).isEqualTo(1);

        server.takeRequest(); // skip GET
        RecordedRequest firstPost = server.takeRequest();
        assertThat(firstPost.getMethod()).isEqualTo("POST");
        String firstBody = firstPost.getBody().readUtf8();
        assertThat(firstBody).contains("sap-wd-secure-id=CSRF-0");
        assertThat(firstBody).contains("SAPEVENTQUEUE=");
        // mergeSetCookies must carry the upstream Set-Cookie through to the POST.
        assertThat(firstPost.getHeader("Cookie"))
                .contains("MYSAPSSO2=abc")
                .contains("SAP_SESSIONID_SSP_100=ABCD");

        RecordedRequest secondPost = server.takeRequest();
        assertThat(secondPost.getBody().readUtf8()).contains("sap-wd-secure-id=CSRF-1");
    }

    @Test
    void iterateStopsWhenSecureIdGoesMissingMidWalk() throws Exception {
        // GET returns the timetable but with NO secure-id input — iterate
        // refuses to POST without a CSRF token and returns only the current term.
        server.enqueue(htmlOk(loadFixture()));

        ScheduleResponse response = connector.fetchSchedule("20221234",
                new PortalCookies("MYSAPSSO2=abc"));

        assertThat(response.terms()).hasSize(1);
        assertThat(response.terms().get(0).year()).isEqualTo(2026);
        assertThat(response.terms().get(0).term()).isEqualTo(1);
        assertThat(server.getRequestCount()).isEqualTo(1);
    }

    @Test
    void loginPageInsteadOfTimetableTriggersSaintSessionExpired() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .setBody("<html><body><form action=\"/logon\">login required</form></body></html>"));

        assertThatThrownBy(() -> connector.fetchSchedule("20221234",
                new PortalCookies("MYSAPSSO2=expired")))
                .isInstanceOf(SaintSessionExpiredException.class);
    }

    @Test
    void mergeSetCookiesAddsNewNamesAndOverwritesExistingOnConflict() {
        String merged = RealSaintScheduleConnector.mergeSetCookies(
                "MYSAPSSO2=keep; saplb_*=old-value",
                List.of("SAP_SESSIONID_SSP_100=NEW; Path=/", "saplb_*=fresh; HttpOnly"));

        assertThat(merged).contains("MYSAPSSO2=keep");
        assertThat(merged).contains("SAP_SESSIONID_SSP_100=NEW");
        // saplb_* was set by both — Set-Cookie wins (LinkedHashMap put overwrites value).
        assertThat(merged).contains("saplb_*=fresh");
        assertThat(merged).doesNotContain("saplb_*=old-value");
    }

    @Test
    void mergeSetCookiesHandlesNullAndEmptyInputs() {
        assertThat(RealSaintScheduleConnector.mergeSetCookies("", null)).isEmpty();
        assertThat(RealSaintScheduleConnector.mergeSetCookies(null, List.of()))
                .isEmpty();
        assertThat(RealSaintScheduleConnector.mergeSetCookies("a=1", null))
                .isEqualTo("a=1");
    }

    private static String loadFixture() throws IOException {
        return Files.readString(
                Path.of("src", "test", "resources", "saint", "timetable-success.html"),
                StandardCharsets.UTF_8);
    }

    /**
     * Synthesizes a minimal timetable page with a specific (year, term)
     * pair in the 학년도/학기 dropdown anchors and the same lecture rows
     * as the pinned fixture. Used by the multi-term iterate test to drive
     * the connector through a chosen cycle path without committing four
     * extra full-page fixtures.
     */
    private static String synthFixture(int year, String termLabel) throws IOException {
        String full = loadFixture();
        // Pinned fixture value="2026학년도" / value="1학기" — swap to
        // the requested (year, term).
        return full
                .replace("value=\"2026학년도\"", "value=\"" + year + "학년도\"")
                .replace("value=\"1학기\"", "value=\"" + termLabel + "\"");
    }

    private static String withSecureId(String html, String value) {
        // Inject a hidden secure-id input next to the table so the unwrapper
        // can find it. Any location inside the document is fine.
        String injection = "<input type=\"hidden\" name=\"sap-wd-secure-id\" value=\""
                + value + "\"/>";
        return html.replace("<body>", "<body>" + injection);
    }

    private static String wrap(String html) {
        return "<updates><full-update windowid=\"sapwd_main_window\">"
                + "<content-update id=\"sapwd_main_window_root_\">"
                + "<![CDATA[" + html + "]]>"
                + "</content-update></full-update></updates>";
    }

    private static MockResponse htmlOk(String body) {
        return new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .setBody(body);
    }

    private static MockResponse xmlOk(String body) {
        return new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/xml; charset=utf-8")
                .setBody(body);
    }
}

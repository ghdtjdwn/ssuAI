package com.ssuai.domain.saint.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        // Chrome UA → SAP WDA returns JS bootstrap on GET, then serves the
        // real timetable HTML on the initial placeholder-load POST.
        // Pinned fixture shows (2026, 1학기). Enrolled 2026 → no PREV needed.
        server.enqueue(htmlOk(withSecureId("<html><body>"
                + "<input type=\"hidden\" name=\"sap-wd-cltwndid\" value=\"WID-123\"/>"
                + "</body></html>", "CSRF-BOOT")));
        server.enqueue(xmlOk(wrap(loadFixture()))); // initial load response

        ScheduleResponse response = connector.fetchSchedule("20261234",
                new PortalCookies("MYSAPSSO2=abc"));

        assertThat(response.enrollmentYear()).isEqualTo(2026);
        assertThat(response.currentYear()).isEqualTo(2026);
        assertThat(response.currentTerm()).isEqualTo(1);
        assertThat(response.terms()).hasSize(1);
        assertThat(response.terms().get(0).entries()).hasSize(7);
        assertThat(server.getRequestCount()).isEqualTo(2); // GET + initial load POST

        RecordedRequest getReq = server.takeRequest();
        assertThat(getReq.getMethod()).isEqualTo("GET");
        assertThat(getReq.getHeader("Cookie")).contains("MYSAPSSO2=abc");

        RecordedRequest initPost = server.takeRequest();
        assertThat(initPost.getMethod()).isEqualTo("POST");
        assertThat(initPost.getBody().readUtf8()).contains("sap-wd-secure-id=CSRF-BOOT");
    }

    @Test
    void initialAndPrevPostsUseFinalGetUrlAfterRedirect() throws Exception {
        SaintScheduleProperties properties = new SaintScheduleProperties();
        properties.setTimetableUrl(server.url("/router").toString());
        properties.setTimeout(Duration.ofSeconds(5));
        HttpClient postClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        HttpClient noRedirectClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        connector = new RealSaintScheduleConnector(properties, CLOCK_2026_05_16, postClient, noRedirectClient);

        server.enqueue(new MockResponse()
                .setResponseCode(302)
                .setHeader("Location", "/hana-zcmw2102?sap-client=100&sap-language=KO"));
        server.enqueue(htmlOk(withSecureId("<html><body>"
                + "<form id=\"sap.client.SsrClient.form\" action=\"/hana-zcmw2102?sap-client=100&amp;sap-language=KO\">"
                + "<input type=\"hidden\" name=\"sap-wd-cltwndid\" value=\"WID-123\"/>"
                + "</form>"
                + "</body></html>", "CSRF-BOOT")));
        server.enqueue(xmlOk(wrap(withSecureId(synthFixture(2026, "1학기"), "CSRF-0"))));
        server.enqueue(xmlOk(wrap(synthFixture(2025, "겨울학기"))));

        connector.fetchSchedule("20251234", new PortalCookies("MYSAPSSO2=abc"));

        RecordedRequest routerGet = server.takeRequest();
        assertThat(routerGet.getMethod()).isEqualTo("GET");
        assertThat(routerGet.getPath()).isEqualTo("/router");

        RecordedRequest finalGet = server.takeRequest();
        assertThat(finalGet.getMethod()).isEqualTo("GET");
        assertThat(finalGet.getPath()).isEqualTo("/hana-zcmw2102?sap-client=100&sap-language=KO");

        RecordedRequest initPost = server.takeRequest();
        assertThat(initPost.getMethod()).isEqualTo("POST");
        assertThat(initPost.getPath()).isEqualTo("/hana-zcmw2102?sap-client=100&sap-language=KO");
        String initBody = initPost.getBody().readUtf8();
        assertThat(initBody).contains("sap-wd-secure-id=CSRF-BOOT");
        assertThat(initBody).doesNotContain("sap-wd-cltwndid");

        RecordedRequest prevPost = server.takeRequest();
        assertThat(prevPost.getMethod()).isEqualTo("POST");
        assertThat(prevPost.getPath()).isEqualTo("/hana-zcmw2102?sap-client=100&sap-language=KO");
        String prevBody = prevPost.getBody().readUtf8();
        assertThat(prevBody).contains("sap-wd-secure-id=CSRF-0");
        assertThat(prevBody).doesNotContain("sap-wd-cltwndid");
    }

    @Test
    void initPostPassesSessionHiddenFieldsExceptCltwndid() throws Exception {
        server.enqueue(htmlOk(
                "<html><body>"
                        + "<form id=\"sap.client.SsrClient.form\" action=\"/zcmw2102\">"
                        + "<input type=\"hidden\" name=\"_external_session_\" value=\"EXT-999\"/>"
                        + "<input type=\"hidden\" name=\"_popup_url_\" value=\"POP\"/>"
                        + "<input type=\"hidden\" name=\"sap-wd-cltwndid\" value=\"WID-EXCLUDED\"/>"
                        + "<input type=\"hidden\" name=\"sap-wd-secure-id\" value=\"CSRF-S\"/>"
                        + "</form></body></html>"));
        server.enqueue(xmlOk(wrap(loadFixture())));

        connector.fetchSchedule("20261234", new PortalCookies("MYSAPSSO2=abc"));

        server.takeRequest(); // GET
        RecordedRequest initPost = server.takeRequest();
        String body = initPost.getBody().readUtf8();
        assertThat(body).doesNotContain("_external_session_");
        assertThat(body).doesNotContain("_popup_url_");
        assertThat(body).doesNotContain("sap-wd-cltwndid");
        assertThat(body).contains("sap-wd-secure-id=CSRF-S");
    }

    @Test
    void webDynproFormPreservesSessionFieldsExceptCltwndid() {
        Map<String, String> bootstrapHidden = new LinkedHashMap<>();
        bootstrapHidden.put("_popup_url_", "x");
        bootstrapHidden.put("_main_window_id_", "y");
        bootstrapHidden.put("_environment_", "z");
        bootstrapHidden.put("_external_session_", "w");
        bootstrapHidden.put("sap-wd-cltwndid", "drop");

        Map<String, String> form = RealSaintScheduleConnector.webDynproForm(
                bootstrapHidden, "secure-abc", "ZCMW2102", "QUEUE");

        assertThat(form.keySet()).containsExactly(
                "sap-charset", "sap-wd-secure-id", "fesrAppName", "fesrUseBeacon", "SAPEVENTQUEUE");
        assertThat(form).doesNotContainKey("_external_session_");
        assertThat(form).doesNotContainKey("_popup_url_");
        assertThat(form).doesNotContainKey("sap-wd-cltwndid");
        assertThat(form).containsEntry("sap-wd-secure-id", "secure-abc");
        assertThat(form).containsEntry("fesrAppName", "ZCMW2102");
        assertThat(form).containsEntry("SAPEVENTQUEUE", "QUEUE");
    }

    @Test
    void eccBootstrapCookieHeaderExtractsOnlyMysapsso2AndWaf() {
        String portal = "WAF=waf; MYSAPSSO2=token; JSESSIONID=jsession; PortalAlias=pa; saplb_0=lb";

        assertThat(RealSaintScheduleConnector.eccBootstrapCookieHeader(portal))
                .isEqualTo("WAF=waf; MYSAPSSO2=token");
    }

    @Test
    void eccBootstrapCookieHeaderReturnsEmptyWhenNoMysapsso2AndWaf() {
        String portal = "JSESSIONID=jsession; PortalAlias=pa";

        assertThat(RealSaintScheduleConnector.eccBootstrapCookieHeader(portal)).isEmpty();
    }

    @Test
    void firstGetWithRenderedTimetableDoesNotSendInitialPost() throws Exception {
        server.enqueue(htmlOk(withSecureId(loadFixture(), "CSRF-GET")));

        ScheduleResponse response = connector.fetchSchedule("20261234",
                new PortalCookies("WAF=portal; MYSAPSSO2=abc; JSESSIONID=saint-only"));

        assertThat(response.terms()).hasSize(1);
        assertThat(response.terms().get(0).entries()).hasSize(7);
        assertThat(server.getRequestCount()).isEqualTo(1);

        RecordedRequest getReq = server.takeRequest();
        assertThat(getReq.getMethod()).isEqualTo("GET");
        assertThat(getReq.getHeader("Cookie")).contains("MYSAPSSO2=abc");
        assertThat(getReq.getHeader("Cookie")).contains("WAF=portal");
        assertThat(getReq.getHeader("Cookie")).doesNotContain("JSESSIONID=saint-only");
    }

    @Test
    void multiTermIteratePostsPrevButtonPerStepAndLabelsEachHopFromTheResponse() throws Exception {
        // GET → bootstrap (CSRF-BOOT) → initial POST returns 2026/1학기 (CSRF-0)
        // → 4 PREV POSTs walk back through (겨울→2학기→여름→1학기). Student
        // enrolled 2025-1학기 → stops after 1학기 response.
        String bootstrap = withSecureId("<html><body></body></html>", "CSRF-BOOT");
        String initLoad = wrap(withSecureId(synthFixture(2026, "1학기"), "CSRF-0"));
        String postWinter2025 = wrap(withSecureId(synthFixture(2025, "겨울학기"), "CSRF-1"));
        String postFall2025 = wrap(withSecureId(synthFixture(2025, "2학기"), "CSRF-2"));
        String postSummer2025 = wrap(withSecureId(synthFixture(2025, "여름학기"), "CSRF-3"));
        String postSpring2025 = wrap(synthFixture(2025, "1학기"));

        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .addHeader("Set-Cookie", "SAP_SESSIONID_SSP_100=ABCD; Path=/")
                .setBody(bootstrap));
        server.enqueue(xmlOk(initLoad));
        server.enqueue(xmlOk(postWinter2025));
        server.enqueue(xmlOk(postFall2025));
        server.enqueue(xmlOk(postSummer2025));
        server.enqueue(xmlOk(postSpring2025));

        ScheduleResponse response = connector.fetchSchedule("20251234",
                new PortalCookies("MYSAPSSO2=abc"));

        // GET + initial POST + 4 PREV POSTs = 6 server hits / 5 terms.
        assertThat(server.getRequestCount()).isEqualTo(6);
        assertThat(response.terms()).hasSize(5);
        assertThat(response.terms().get(0).year()).isEqualTo(2026);
        assertThat(response.terms().get(0).term()).isEqualTo(1);
        assertThat(response.terms().get(1).year()).isEqualTo(2025);
        assertThat(response.terms().get(1).term()).isEqualTo(4);
        assertThat(response.terms().get(2).term()).isEqualTo(3);
        assertThat(response.terms().get(3).term()).isEqualTo(2);
        assertThat(response.terms().get(4).year()).isEqualTo(2025);
        assertThat(response.terms().get(4).term()).isEqualTo(1);

        server.takeRequest(); // skip GET
        RecordedRequest initPost = server.takeRequest();
        assertThat(initPost.getMethod()).isEqualTo("POST");
        String initBody = initPost.getBody().readUtf8();
        assertThat(initBody).contains("sap-wd-secure-id=CSRF-BOOT");
        assertThat(initBody).contains("SAPEVENTQUEUE=");
        // mergeSetCookies must carry the upstream Set-Cookie through to the POST.
        assertThat(initPost.getHeader("Cookie"))
                .contains("MYSAPSSO2=abc")
                .contains("SAP_SESSIONID_SSP_100=ABCD");

        RecordedRequest firstPrevPost = server.takeRequest();
        assertThat(firstPrevPost.getBody().readUtf8()).contains("sap-wd-secure-id=CSRF-0");

        RecordedRequest secondPrevPost = server.takeRequest();
        assertThat(secondPrevPost.getBody().readUtf8()).contains("sap-wd-secure-id=CSRF-1");
    }

    @Test
    void iterateStopsWhenSecureIdGoesMissingMidWalk() throws Exception {
        // Bootstrap GET provides CSRF-BOOT; initial POST returns the timetable
        // but WITHOUT a secure-id, so the iterate loop cannot PREV-POST and stops.
        server.enqueue(htmlOk(withSecureId("<html><body></body></html>", "CSRF-BOOT")));
        server.enqueue(xmlOk(wrap(loadFixture()))); // no secure-id in payload

        ScheduleResponse response = connector.fetchSchedule("20221234",
                new PortalCookies("MYSAPSSO2=abc"));

        assertThat(response.terms()).hasSize(1);
        assertThat(response.terms().get(0).year()).isEqualTo(2026);
        assertThat(response.terms().get(0).term()).isEqualTo(1);
        assertThat(server.getRequestCount()).isEqualTo(2); // GET + initial POST only
    }

    @Test
    void guardAuthOrThrowPassesWhenOnlyDropdownsPresent() {
        String html = """
                <html><body>
                  <label for="WD01">학년도</label>
                  <input id="WD01" value="2026학년도"/>
                  <label for="WD02">학기</label>
                  <input id="WD02" value="여름학기"/>
                </body></html>
                """;

        assertThatNoException().isThrownBy(() -> connector.guardAuthOrThrow(html, "20221528"));
    }

    @Test
    void guardAuthOrThrowFailsWhenNoDropdowns() {
        String html = "<html><body><h1>SAP Logon</h1></body></html>";

        assertThatThrownBy(() -> connector.guardAuthOrThrow(html, "20221528"))
                .isInstanceOf(SaintSessionExpiredException.class)
                .hasMessageContaining("did not render the term dropdowns");
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

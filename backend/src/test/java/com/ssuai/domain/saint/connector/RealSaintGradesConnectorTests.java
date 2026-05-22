package com.ssuai.domain.saint.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssuai.domain.auth.saint.PortalCookies;
import com.ssuai.domain.saint.config.SaintGradesProperties;
import com.ssuai.domain.saint.dto.GradesResponse;
import com.ssuai.global.exception.SaintSessionExpiredException;

class RealSaintGradesConnectorTests {

    private MockWebServer server;
    private RealSaintGradesConnector connector;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        SaintGradesProperties properties = new SaintGradesProperties();
        properties.setGradesUrl(server.url("/zcmb3w0017").toString());
        properties.setTimeout(Duration.ofSeconds(5));
        HttpClient httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        connector = new RealSaintGradesConnector(properties, httpClient);
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void firstGetParsesHistorySummariesAndIteratesPrevButtonForEachPriorTerm() throws Exception {
        String firstFixture = loadFixture("grades-success.html");
        String prevFixture = loadFixture("grades-prev-success.html");

        // GET returns SAP WDA bootstrap, then initial placeholder-load POST
        // returns the current page (6 history rows, empty detail).
        server.enqueue(bootstrapOk("CSRF-BOOT")
                .addHeader("Set-Cookie", "SAP_SESSIONID_SSP_100=GR-SESS; Path=/")
        );
        server.enqueue(xmlOk(firstFixture));
        // 5 prev POSTs follow (history.size() - 1 = 5).
        for (int i = 0; i < 5; i++) {
            server.enqueue(xmlOk(prevFixture));
        }

        GradesResponse response = connector.fetchGrades("20221528",
                new PortalCookies("MYSAPSSO2=abc"));

        assertThat(response.history()).hasSize(6);
        assertThat(response.academicRecord().gpa()).isEqualTo(3.50d);
        assertThat(response.certificate().gpa()).isEqualTo(3.50d);
        // Five prev hops populated five history.get(1..5) keys; the
        // current-term (history[0]) detail stayed empty.
        assertThat(response.detailsByTerm()).hasSize(5);
        assertThat(server.getRequestCount()).isEqualTo(7);

        RecordedRequest first = server.takeRequest();
        assertThat(first.getMethod()).isEqualTo("GET");
        assertThat(first.getHeader("Cookie")).contains("MYSAPSSO2=abc");

        RecordedRequest initPost = server.takeRequest();
        assertThat(initPost.getMethod()).isEqualTo("POST");
        assertThat(initPost.getHeader("Content-Type"))
                .startsWith("application/x-www-form-urlencoded");
        String body = initPost.getBody().readUtf8();
        assertThat(body).contains("sap-wd-secure-id=CSRF-BOOT");
        assertThat(body).contains("SAPEVENTQUEUE=");
        // mergeSetCookies must carry the Set-Cookie from the first GET
        // into the subsequent POSTs so the SAP session affinity holds.
        assertThat(initPost.getHeader("Cookie"))
                .contains("MYSAPSSO2=abc")
                .contains("SAP_SESSIONID_SSP_100=GR-SESS");

        RecordedRequest firstPrevPost = server.takeRequest();
        assertThat(firstPrevPost.getBody().readUtf8())
                .contains("sap-wd-secure-id=92AC1288589D3E4A398E724EED71D17A");
    }

    @Test
    void initialPostUsesFinalGetUrlAfterRedirect() throws Exception {
        SaintGradesProperties properties = new SaintGradesProperties();
        properties.setGradesUrl(server.url("/router").toString());
        properties.setTimeout(Duration.ofSeconds(5));
        HttpClient postClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        HttpClient noRedirectClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        connector = new RealSaintGradesConnector(properties, postClient, noRedirectClient);

        String htmlOnly = minimalTermHistoryHtml();
        server.enqueue(new MockResponse()
                .setResponseCode(302)
                .setHeader("Location", "/hana-zcmb3w0017?sap-client=100&sap-language=KO"));
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .setBody("<html><body>"
                        + "<form id=\"sap.client.SsrClient.form\" action=\"/hana-zcmb3w0017?sap-client=100&amp;sap-language=KO\">"
                        + "<input type=\"hidden\" name=\"sap-wd-secure-id\" value=\"CSRF-BOOT\"/>"
                        + "</form>"
                        + "</body></html>"));
        server.enqueue(xmlOk(wrap(htmlOnly
                + "<input id=\"sap-wd-secure-id\" name=\"sap-wd-secure-id\" value=\"CSRF\"/>")));

        connector.fetchGrades("20221528", new PortalCookies("MYSAPSSO2=abc"));

        RecordedRequest routerGet = server.takeRequest();
        assertThat(routerGet.getMethod()).isEqualTo("GET");
        assertThat(routerGet.getPath()).isEqualTo("/router");

        RecordedRequest finalGet = server.takeRequest();
        assertThat(finalGet.getMethod()).isEqualTo("GET");
        assertThat(finalGet.getPath()).isEqualTo("/hana-zcmb3w0017?sap-client=100&sap-language=KO");

        RecordedRequest initPost = server.takeRequest();
        assertThat(initPost.getMethod()).isEqualTo("POST");
        assertThat(initPost.getPath()).isEqualTo("/hana-zcmb3w0017?sap-client=100&sap-language=KO");
        String initBody = initPost.getBody().readUtf8();
        assertThat(initBody).contains("sap-wd-secure-id=CSRF-BOOT");
        assertThat(initBody).doesNotContain("sap-wd-cltwndid");
    }

    @Test
    void initPostDoesNotEchoBootstrapHiddenFields() throws Exception {
        String bootstrapHtml =
                "<html><body>"
                        + "<form id=\"sap.client.SsrClient.form\" action=\"/zcmb3w0017\">"
                        + "<input type=\"hidden\" name=\"_external_session_\" value=\"EXT-999\"/>"
                        + "<input type=\"hidden\" name=\"_popup_url_\" value=\"POP\"/>"
                        + "<input type=\"hidden\" name=\"sap-wd-cltwndid\" value=\"WID-EXCLUDED\"/>"
                        + "<input type=\"hidden\" name=\"sap-wd-secure-id\" value=\"CSRF-G\"/>"
                        + "</form></body></html>";
        String htmlOnly = minimalTermHistoryHtml()
                + "<input id=\"sap-wd-secure-id\" name=\"sap-wd-secure-id\" value=\"CSRF-1\"/>";
        server.enqueue(htmlOk(bootstrapHtml));
        server.enqueue(xmlOk(wrap(htmlOnly)));

        connector.fetchGrades("20261234", new PortalCookies("MYSAPSSO2=abc"));

        server.takeRequest(); // GET
        RecordedRequest initPost = server.takeRequest();
        String body = initPost.getBody().readUtf8();
        assertThat(body).doesNotContain("_external_session_");
        assertThat(body).doesNotContain("_popup_url_");
        assertThat(body).doesNotContain("sap-wd-cltwndid");
        assertThat(body).contains("sap-wd-secure-id=CSRF-G");
    }

    @Test
    void webDynproFormContainsOnlyFiveCanonicalFields() {
        Map<String, String> bootstrapHidden = new LinkedHashMap<>();
        bootstrapHidden.put("_popup_url_", "x");
        bootstrapHidden.put("_main_window_id_", "y");
        bootstrapHidden.put("_environment_", "z");
        bootstrapHidden.put("_external_session_", "w");
        bootstrapHidden.put("sap-wd-cltwndid", "drop");

        Map<String, String> form = RealSaintGradesConnector.webDynproForm(
                bootstrapHidden, "secure-abc", "ZCMB3W0017", "QUEUE");

        assertThat(form.keySet()).containsExactly(
                "sap-charset", "sap-wd-secure-id", "fesrAppName", "fesrUseBeacon", "SAPEVENTQUEUE");
        assertThat(form).containsEntry("sap-wd-secure-id", "secure-abc");
        assertThat(form).containsEntry("fesrAppName", "ZCMB3W0017");
        assertThat(form).containsEntry("SAPEVENTQUEUE", "QUEUE");
    }

    @Test
    void eccBootstrapCookieHeaderExtractsOnlyMysapsso2AndWaf() {
        String portal = "WAF=waf; MYSAPSSO2=token; JSESSIONID=jsession; PortalAlias=pa; saplb_0=lb";

        assertThat(RealSaintGradesConnector.eccBootstrapCookieHeader(portal))
                .isEqualTo("WAF=waf; MYSAPSSO2=token");
    }

    @Test
    void eccBootstrapCookieHeaderReturnsEmptyWhenNoMysapsso2AndWaf() {
        String portal = "JSESSIONID=jsession; PortalAlias=pa";

        assertThat(RealSaintGradesConnector.eccBootstrapCookieHeader(portal)).isEmpty();
    }

    @Test
    void firstGetWithRenderedGradesDoesNotSendInitialPost() throws Exception {
        String firstFixture = loadFixture("grades-success.html");
        String prevFixture = loadFixture("grades-prev-success.html");

        server.enqueue(htmlOk(firstFixture));
        for (int i = 0; i < 5; i++) {
            server.enqueue(xmlOk(prevFixture));
        }

        GradesResponse response = connector.fetchGrades("20221528",
                new PortalCookies("WAF=portal; MYSAPSSO2=abc; JSESSIONID=saint-only"));

        assertThat(response.history()).hasSize(6);
        assertThat(response.academicRecord().gpa()).isEqualTo(3.50d);
        // GET rendered the history and current page, so only prev POSTs are sent.
        assertThat(server.getRequestCount()).isEqualTo(6);

        RecordedRequest first = server.takeRequest();
        assertThat(first.getMethod()).isEqualTo("GET");
        assertThat(first.getHeader("Cookie")).contains("MYSAPSSO2=abc");
        assertThat(first.getHeader("Cookie")).contains("WAF=portal");
        assertThat(first.getHeader("Cookie")).doesNotContain("JSESSIONID=saint-only");
        RecordedRequest firstPrevPost = server.takeRequest();
        assertThat(firstPrevPost.getMethod()).isEqualTo("POST");
        assertThat(firstPrevPost.getBody().readUtf8())
                .contains("sap-wd-secure-id=92AC1288589D3E4A398E724EED71D17A");
    }

    @Test
    void emptyHistoryTriggersSaintSessionExpiredBeforeAnyPrevPost() {
        String htmlOnly = "<TABLE><tbody id=\"WD65-contentTBody\"><tr rt=\"2\"></tr></tbody></TABLE>";
        server.enqueue(bootstrapOk("CSRF-BOOT"));
        server.enqueue(xmlOk(wrap(htmlOnly
                + "<input id=\"sap-wd-secure-id\" name=\"sap-wd-secure-id\" value=\"CSRF\"/>")));

        assertThatThrownBy(() -> connector.fetchGrades("20221528",
                new PortalCookies("MYSAPSSO2=abc")))
                .isInstanceOf(SaintSessionExpiredException.class)
                .hasMessageContaining("term GPA history");
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void guardAuthOrThrowPassesWhenTermHistoryNonEmpty() {
        assertThatNoException().isThrownBy(() ->
                connector.guardAuthOrThrow(minimalTermHistoryHtml(), "20221528"));
    }

    @Test
    void guardAuthOrThrowFailsWhenNoTermHistory() {
        String html = "<html><body><h1>SAP Logon</h1></body></html>";

        assertThatThrownBy(() -> connector.guardAuthOrThrow(html, "20221528"))
                .isInstanceOf(SaintSessionExpiredException.class)
                .hasMessageContaining("term GPA history");
    }

    @Test
    void loginPageInsteadOfGradesTriggersSaintSessionExpired() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .setBody("<html><body><form action=\"/logon\">login required</form></body></html>"));

        assertThatThrownBy(() -> connector.fetchGrades("20221528",
                new PortalCookies("MYSAPSSO2=expired")))
                .isInstanceOf(SaintSessionExpiredException.class);
    }

    private static String loadFixture(String name) throws IOException {
        return Files.readString(
                Path.of("src", "test", "resources", "saint", name),
                StandardCharsets.UTF_8);
    }

    private static MockResponse bootstrapOk(String secureId) {
        return bootstrapOk(secureId, "");
    }

    private static MockResponse bootstrapOk(String secureId, String extraHiddenInputs) {
        return new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .setBody("<html><body><form id=\"sap.client.SsrClient.form\">"
                        + "<input type=\"hidden\" name=\"sap-wd-secure-id\" value=\"" + secureId + "\"/>"
                        + extraHiddenInputs
                        + "</form></body></html>");
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

    private static String wrap(String html) {
        return "<updates><full-update windowid=\"sapwd_main_window\">"
                + "<content-update id=\"sapwd_main_window_root_\">"
                + "<![CDATA[" + html + "]]>"
                + "</content-update></full-update></updates>";
    }

    private static String minimalTermHistoryHtml() {
        return """
                <TABLE>
                  <tbody id="WD65-contentTBody">
                    <tr rt="1">
                      <td role="gridcell" cc="1"><span class="lsTextView--wrap">2025</span></td>
                      <td role="gridcell" cc="2"><span class="lsTextView--wrap">2학기</span></td>
                    </tr>
                  </tbody>
                </TABLE>
                """;
    }
}

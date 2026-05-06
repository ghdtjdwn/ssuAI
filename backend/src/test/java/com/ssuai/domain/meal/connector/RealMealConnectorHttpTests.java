package com.ssuai.domain.meal.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssuai.domain.meal.dto.MealItem;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.global.exception.ConnectorParseException;
import com.ssuai.global.exception.ConnectorTimeoutException;
import com.ssuai.global.exception.ConnectorUnavailableException;

class RealMealConnectorHttpTests {

    private static final LocalDate DATE = LocalDate.of(2026, 5, 6);
    private static final Path FIXTURE_PATH = Path.of("src/test/resources/fixtures/meal/today-success.html");
    private static final Path DODAM_CHILDRENS_DAY_FIXTURE_PATH =
            Path.of("src/test/resources/fixtures/meal/dodam-childrens-day-closure.html");

    private MockWebServer server;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void fetchMealParsesSuccessfulResponse() throws Exception {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/plain; charset=utf-8")
                .setBody(fixture()));
        enqueueClosedResponses(5);
        RealMealConnector connector = connectorWithTimeout(1_000);

        MealResponse response = connector.fetchMeal(DATE);

        assertThat(response.meals()).hasSize(4);
        assertThat(response.meals())
                .extracting(MealItem::restaurant)
                .containsOnly("학생식당");
        assertThat(response.closures())
                .extracting(closure -> closure.reason())
                .containsExactly(
                        "오늘은 쉽니다.",
                        "오늘은 쉽니다.",
                        "오늘은 쉽니다.",
                        "오늘은 쉽니다.",
                        "오늘은 쉽니다."
                );
        assertThat(takeRequestPaths())
                .containsExactly(
                        "/m/m_req/m_menu.php?rcd=1&sdt=20260506",
                        "/m/m_req/m_menu.php?rcd=2&sdt=20260506",
                        "/m/m_req/m_menu.php?rcd=4&sdt=20260506",
                        "/m/m_req/m_menu.php?rcd=5&sdt=20260506",
                        "/m/m_req/m_menu.php?rcd=6&sdt=20260506",
                        "/m/m_req/m_menu.php?rcd=7&sdt=20260506"
                );
    }

    @Test
    void fetchMealThrowsUnavailableForHttp503() {
        server.enqueue(new MockResponse().setResponseCode(503));
        RealMealConnector connector = connectorWithTimeout(1_000);

        assertThatThrownBy(() -> connector.fetchMeal(DATE))
                .isInstanceOf(ConnectorUnavailableException.class);
    }

    @Test
    void fetchMealThrowsTimeoutWhenServerDoesNotRespond() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeadersDelay(500, TimeUnit.MILLISECONDS)
                .setBody(fixtureUnchecked()));
        RealMealConnector connector = connectorWithTimeout(100);

        assertThatThrownBy(() -> connector.fetchMeal(DATE))
                .isInstanceOf(ConnectorTimeoutException.class);
    }

    @Test
    void fetchMealThrowsParseExceptionForEmptyHtml() {
        enqueueEmptyResponses(6);
        RealMealConnector connector = connectorWithTimeout(1_000);

        assertThatThrownBy(() -> connector.fetchMeal(DATE))
                .isInstanceOf(ConnectorParseException.class);
    }

    @Test
    void fetchMealReturnsClosuresWhenAllRestaurantsAreClosed() {
        enqueueClosedResponses(6);
        RealMealConnector connector = connectorWithTimeout(1_000);

        MealResponse response = connector.fetchMeal(DATE);

        assertThat(response.meals()).isEmpty();
        assertThat(response.closures())
                .hasSize(6)
                .allSatisfy(closure -> assertThat(closure.reason()).isEqualTo("오늘은 쉽니다."));
    }

    @Test
    void fetchMealReturnsClosureForHolidayNoticeInsideMenuRow() {
        enqueueClosedResponses(1);
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/plain; charset=utf-8")
                .setBody(dodamChildrensDayFixtureUnchecked()));
        enqueueClosedResponses(4);
        RealMealConnector connector = connectorWithTimeout(1_000);

        MealResponse response = connector.fetchMeal(DATE);

        assertThat(response.meals()).isEmpty();
        assertThat(response.closures())
                .filteredOn(closure -> closure.restaurant().equals("숭실도담식당"))
                .singleElement()
                .satisfies(closure -> assertThat(closure.reason()).contains("어린이날"));
    }

    private RealMealConnector connectorWithTimeout(int timeoutMs) {
        return new RealMealConnector(server.url("/m/m_req/m_menu.php").toString(), 0L, timeoutMs);
    }

    private static String fixture() throws Exception {
        return Files.readString(FIXTURE_PATH, StandardCharsets.UTF_8);
    }

    private void enqueueEmptyResponses(int count) {
        for (int i = 0; i < count; i++) {
            server.enqueue(new MockResponse()
                    .setResponseCode(200)
                    .setHeader("Content-Type", "text/plain; charset=utf-8")
                    .setBody("<html><body></body></html>")
                    .setBodyDelay(1, TimeUnit.MILLISECONDS));
        }
    }

    private void enqueueClosedResponses(int count) {
        for (int i = 0; i < count; i++) {
            server.enqueue(new MockResponse()
                    .setResponseCode(200)
                    .setHeader("Content-Type", "text/plain; charset=utf-8")
                    .setBody("""
                            <table>
                                <tr><td colspan="2">일 월 화 수 목 금 토</td></tr>
                                <tr><td colspan="2">오늘은 쉽니다.</td></tr>
                            </table>
                            """));
        }
    }

    private List<String> takeRequestPaths() throws Exception {
        List<String> paths = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            RecordedRequest request = server.takeRequest();
            if (i == 0) {
                assertThat(request.getHeader("User-Agent")).isEqualTo("ssuAI/0.1 (+akftjdwn@gmail.com)");
                assertThat(request.getHeader("Accept-Language")).isEqualTo("ko-KR,ko;q=0.9");
            }
            paths.add(request.getPath());
        }
        return paths;
    }

    private static String fixtureUnchecked() {
        try {
            return fixture();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String dodamChildrensDayFixtureUnchecked() {
        try {
            return Files.readString(DODAM_CHILDRENS_DAY_FIXTURE_PATH, StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}

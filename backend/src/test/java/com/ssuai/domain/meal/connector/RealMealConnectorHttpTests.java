package com.ssuai.domain.meal.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.concurrent.TimeUnit;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ssuai.domain.meal.dto.MealItem;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.dto.MealRestaurant;
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
        RealMealConnector connector = connectorWithTimeout(5_000);

        MealResponse response = connector.fetchMeal(DATE, MealRestaurant.STUDENT);

        assertThat(response.meals())
                .hasSize(4)
                .extracting(MealItem::restaurant)
                .containsOnly("학생식당");
        assertThat(response.closures()).isEmpty();

        RecordedRequest request = server.takeRequest();
        assertThat(request.getPath()).isEqualTo("/m/m_req/m_menu.php?rcd=1&sdt=20260506");
        assertThat(request.getHeader("User-Agent")).isEqualTo("ssuAI/0.1 (+akftjdwn@gmail.com)");
        assertThat(request.getHeader("Accept-Language")).isEqualTo("ko-KR,ko;q=0.9");
    }

    @Test
    void fetchMealUsesRestaurantCodeInQueryString() throws Exception {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/plain; charset=utf-8")
                .setBody(closedBody()));
        RealMealConnector connector = connectorWithTimeout(5_000);

        connector.fetchMeal(DATE, MealRestaurant.FACULTY_LOUNGE);

        assertThat(server.takeRequest().getPath())
                .isEqualTo("/m/m_req/m_menu.php?rcd=7&sdt=20260506");
    }

    @Test
    void fetchMealThrowsUnavailableForHttp503() {
        server.enqueue(new MockResponse().setResponseCode(503));
        RealMealConnector connector = connectorWithTimeout(5_000);

        assertThatThrownBy(() -> connector.fetchMeal(DATE, MealRestaurant.STUDENT))
                .isInstanceOf(ConnectorUnavailableException.class);
    }

    @Test
    void fetchMealThrowsTimeoutWhenServerDoesNotRespond() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeadersDelay(500, TimeUnit.MILLISECONDS)
                .setBody(fixtureUnchecked()));
        RealMealConnector connector = connectorWithTimeout(100);

        assertThatThrownBy(() -> connector.fetchMeal(DATE, MealRestaurant.STUDENT))
                .isInstanceOf(ConnectorTimeoutException.class);
    }

    @Test
    void fetchMealThrowsParseExceptionForEmptyHtml() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/plain; charset=utf-8")
                .setBody("<html><body></body></html>"));
        RealMealConnector connector = connectorWithTimeout(5_000);

        assertThatThrownBy(() -> connector.fetchMeal(DATE, MealRestaurant.STUDENT))
                .isInstanceOf(ConnectorParseException.class);
    }

    @Test
    void fetchMealReturnsClosureWhenRestaurantIsClosed() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/plain; charset=utf-8")
                .setBody(closedBody()));
        RealMealConnector connector = connectorWithTimeout(5_000);

        MealResponse response = connector.fetchMeal(DATE, MealRestaurant.SNACK);

        assertThat(response.meals()).isEmpty();
        assertThat(response.closures())
                .singleElement()
                .satisfies(closure -> {
                    assertThat(closure.restaurant()).isEqualTo("스낵코너");
                    assertThat(closure.reason()).isEqualTo("오늘은 쉽니다.");
                });
    }

    @Test
    void fetchMealReturnsClosureForHolidayNoticeInsideMenuRow() {
        server.enqueue(new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "text/plain; charset=utf-8")
                .setBody(dodamChildrensDayFixtureUnchecked()));
        RealMealConnector connector = connectorWithTimeout(5_000);

        MealResponse response = connector.fetchMeal(DATE, MealRestaurant.DODAM);

        assertThat(response.meals()).isEmpty();
        assertThat(response.closures())
                .singleElement()
                .satisfies(closure -> {
                    assertThat(closure.restaurant()).isEqualTo("숭실도담식당");
                    assertThat(closure.reason()).contains("어린이날");
                });
    }

    private RealMealConnector connectorWithTimeout(int timeoutMs) {
        return new RealMealConnector(server.url("/m/m_req/m_menu.php").toString(), 0L, timeoutMs);
    }

    private static String fixture() throws Exception {
        return Files.readString(FIXTURE_PATH, StandardCharsets.UTF_8);
    }

    private static String closedBody() {
        return """
                <table>
                    <tr><td colspan="2">일 월 화 수 목 금 토</td></tr>
                    <tr><td colspan="2">오늘은 쉽니다.</td></tr>
                </table>
                """;
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

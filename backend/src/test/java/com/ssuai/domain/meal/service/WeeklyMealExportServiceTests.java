package com.ssuai.domain.meal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.ssuai.domain.meal.connector.MealConnector;
import com.ssuai.domain.meal.dto.MealItem;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.dto.MealRestaurant;
import com.ssuai.domain.meal.dto.MealType;
import com.ssuai.global.exception.ConnectorUnavailableException;

class WeeklyMealExportServiceTests {

    @TempDir
    private Path tempDir;

    private final MealConnector mealConnector = mock(MealConnector.class);
    private final ObjectMapper objectMapper = new ObjectMapper()
            .findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private final MealService mealService = new MealService(mealConnector);
    private final WeeklyMealExportService exportService = new WeeklyMealExportService(mealService, objectMapper);

    @Test
    void exportWeeklyMealsWritesJsonFileForEveryRestaurantAndDay() throws Exception {
        LocalDate startDate = LocalDate.of(2026, 5, 3);
        when(mealConnector.fetchMeal(any(LocalDate.class), any(MealRestaurant.class)))
                .thenAnswer(invocation -> {
                    LocalDate date = invocation.getArgument(0);
                    MealRestaurant restaurant = invocation.getArgument(1);
                    if (restaurant == MealRestaurant.SNACK) {
                        throw new ConnectorUnavailableException(new RuntimeException("503"));
                    }
                    return new MealResponse(
                            date,
                            List.of(new MealItem(
                                    restaurant.displayName(),
                                    MealType.LUNCH,
                                    "중식",
                                    List.of("쌀밥"))));
                });
        Path outputPath = tempDir.resolve("weekly-meals.json");

        exportService.exportWeeklyMeals(startDate, outputPath);

        assertThat(outputPath).exists();
        String json = Files.readString(outputPath, StandardCharsets.UTF_8);
        JsonNode root = objectMapper.readTree(json);
        assertThat(root.path("startDate").asText()).isEqualTo("2026-05-03");
        assertThat(root.path("endDate").asText()).isEqualTo("2026-05-09");
        assertThat(root.path("days")).hasSize(7);

        JsonNode firstDay = root.path("days").get(0);
        assertThat(firstDay.path("meals")).hasSize(MealRestaurant.values().length - 1);
        assertThat(firstDay.path("closures").get(0).path("restaurant").asText()).isEqualTo("스낵코너");
        assertThat(firstDay.path("closures").get(0).path("reason").asText())
                .isEqualTo("조회 실패: CONNECTOR_UNAVAILABLE");

        verify(mealConnector, times(7 * MealRestaurant.values().length))
                .fetchMeal(any(LocalDate.class), any(MealRestaurant.class));
    }
}

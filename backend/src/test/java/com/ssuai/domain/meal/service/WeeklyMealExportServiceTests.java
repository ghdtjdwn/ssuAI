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
import org.mockito.ArgumentCaptor;

import com.ssuai.domain.meal.connector.MealConnector;
import com.ssuai.domain.meal.dto.MealClosure;
import com.ssuai.domain.meal.dto.MealItem;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.dto.MealType;
import com.ssuai.domain.meal.dto.WeeklyMealResponse;

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
    void exportWeeklyMealsWritesJsonFile() throws Exception {
        LocalDate startDate = LocalDate.of(2026, 5, 3);
        when(mealConnector.fetchMeal(any(LocalDate.class)))
                .thenAnswer(invocation -> responseFor(invocation.getArgument(0)));
        Path outputPath = tempDir.resolve("weekly-meals.json");

        WeeklyMealResponse response = exportService.exportWeeklyMeals(startDate, outputPath);

        assertThat(response.days()).hasSize(7);
        assertThat(outputPath).exists();

        String json = Files.readString(outputPath, StandardCharsets.UTF_8);
        JsonNode root = objectMapper.readTree(json);
        assertThat(root.path("startDate").asText()).isEqualTo("2026-05-03");
        assertThat(root.path("endDate").asText()).isEqualTo("2026-05-09");
        assertThat(root.path("days")).hasSize(7);
        assertThat(root.path("days").get(0).path("meals").get(0).path("restaurant").asText())
                .isEqualTo("학생식당");
        assertThat(root.path("days").get(0).path("closures").get(0).path("reason").asText())
                .isEqualTo("오늘은 쉽니다.");

        ArgumentCaptor<LocalDate> dateCaptor = ArgumentCaptor.forClass(LocalDate.class);
        verify(mealConnector, times(7)).fetchMeal(dateCaptor.capture());
        assertThat(dateCaptor.getAllValues())
                .containsExactlyElementsOf(response.days().stream().map(MealResponse::date).toList());
    }

    private static MealResponse responseFor(LocalDate date) {
        return new MealResponse(
                date,
                List.of(new MealItem("학생식당", MealType.LUNCH, "중식1", List.of("쌀밥"))),
                List.of(new MealClosure("스낵코너", "오늘은 쉽니다."))
        );
    }
}

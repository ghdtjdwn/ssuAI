package com.ssuai.domain.meal.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.stream.IntStream;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.dto.WeeklyMealResponse;

@Service
public class WeeklyMealExportService {

    private static final int DAYS_PER_WEEK = 7;

    private final MealService mealService;
    private final ObjectMapper objectMapper;

    public WeeklyMealExportService(MealService mealService, ObjectMapper objectMapper) {
        this.mealService = mealService;
        this.objectMapper = objectMapper;
    }

    public WeeklyMealResponse exportWeeklyMeals(LocalDate startDate, Path outputPath) throws IOException {
        Objects.requireNonNull(startDate);
        Objects.requireNonNull(outputPath);

        WeeklyMealResponse response = fetchWeeklyMeals(startDate);
        Path parent = outputPath.toAbsolutePath().normalize().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath.toFile(), response);

        return response;
    }

    private WeeklyMealResponse fetchWeeklyMeals(LocalDate startDate) {
        List<MealResponse> days = IntStream.range(0, DAYS_PER_WEEK)
                .mapToObj(dayOffset -> mealService.getMeal(startDate.plusDays(dayOffset)))
                .toList();

        return new WeeklyMealResponse(startDate, startDate.plusDays(DAYS_PER_WEEK - 1), days);
    }
}

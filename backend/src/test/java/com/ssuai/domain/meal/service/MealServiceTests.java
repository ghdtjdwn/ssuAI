package com.ssuai.domain.meal.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssuai.domain.meal.connector.MealConnector;
import com.ssuai.domain.meal.dto.MealResponse;

class MealServiceTests {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    private final MealConnector mealConnector = mock(MealConnector.class);
    private final MealService mealService = new MealService(mealConnector);

    @Test
    void getTodayMealFetchesMealForTodayInSeoulTime() {
        MealResponse expected = new MealResponse(LocalDate.of(2026, 5, 6), List.of());
        when(mealConnector.fetchMeal(any(LocalDate.class))).thenReturn(expected);

        LocalDate beforeCall = LocalDate.now(SEOUL_ZONE);
        MealResponse actual = mealService.getTodayMeal();
        LocalDate afterCall = LocalDate.now(SEOUL_ZONE);

        ArgumentCaptor<LocalDate> dateCaptor = ArgumentCaptor.forClass(LocalDate.class);
        verify(mealConnector).fetchMeal(dateCaptor.capture());

        assertThat(actual).isSameAs(expected);
        assertThat(dateCaptor.getValue())
                .isAfterOrEqualTo(beforeCall)
                .isBeforeOrEqualTo(afterCall);
    }
}

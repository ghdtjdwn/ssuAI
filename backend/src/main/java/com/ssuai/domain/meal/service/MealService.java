package com.ssuai.domain.meal.service;

import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Service;

import com.ssuai.domain.meal.connector.MealConnector;
import com.ssuai.domain.meal.dto.MealResponse;

@Service
public class MealService {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    private final MealConnector mealConnector;

    public MealService(MealConnector mealConnector) {
        this.mealConnector = mealConnector;
    }

    public MealResponse getTodayMeal() {
        return getMeal(LocalDate.now(SEOUL_ZONE));
    }

    public MealResponse getMeal(LocalDate date) {
        return mealConnector.fetchMeal(date);
    }
}

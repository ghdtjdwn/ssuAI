package com.ssuai.domain.meal.connector;

import java.time.LocalDate;

import com.ssuai.domain.meal.dto.MealResponse;

public interface MealConnector {

    MealResponse fetchMeal(LocalDate date);
}

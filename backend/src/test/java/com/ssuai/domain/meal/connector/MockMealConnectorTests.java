package com.ssuai.domain.meal.connector;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.ssuai.domain.meal.dto.MealItem;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.dto.MealType;

class MockMealConnectorTests {

    private final MockMealConnector mealConnector = new MockMealConnector();

    @Test
    void fetchMealReturnsMockMealsForRequestedDate() {
        LocalDate date = LocalDate.of(2026, 5, 6);

        MealResponse response = mealConnector.fetchMeal(date);

        assertThat(response.date()).isEqualTo(date);
        assertThat(response.meals())
                .hasSize(3)
                .extracting(MealItem::type)
                .containsExactly(MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER);
        assertThat(response.meals())
                .extracting(MealItem::restaurant)
                .containsExactly("학생식당", "학생식당", "학생식당");
        assertThat(response.meals())
                .extracting(MealItem::corner)
                .containsExactly("조식", "중식", "석식");
        assertThat(response.meals())
                .allSatisfy(meal -> assertThat(meal.menu()).isNotEmpty());
    }
}

package com.ssuai.domain.saint.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import com.ssuai.domain.saint.dto.ScheduleEntry;

/**
 * Parses an SAP WebDynpro ZCMW2102 (개인수업시간표조회) page into
 * {@link ScheduleEntry} rows.
 *
 * <p>Selector contract (Task 16 spec §3.2):
 *
 * <ul>
 *   <li>{@code tbody[id$=-contentTBody]} — the timetable container; the
 *       WD-prefix id is dynamic but the suffix is stable across renders.
 *   <li>{@code tr[rt=1]} — data rows (1교시 ~ 10교시). Header is {@code rt=2}
 *       and we ignore it because the column-to-weekday mapping is encoded
 *       on each cell via {@code cc="N"}.
 *   <li>{@code td[role=gridcell][cc="0"]} — the period column ("1 교시"
 *       / "(08:00-08:50)"). {@code cc="1"..."6"} are 월~토; the u-SAINT
 *       page never emits Sunday cells.
 *   <li>{@code div.lsSTEmptyRow} — sentinel that marks a free slot.
 *   <li>{@code span.lsTextView--wrap} — lecture cell. Inner text is four
 *       newline/{@code <br>}-separated lines: 과목명 / 교수 / 시간 / 강의실.
 * </ul>
 *
 * <p>If u-SAINT changes the cc-to-weekday mapping (extremely unlikely —
 * `cc` has been stable for years), the integration test against the
 * pinned fixture will catch it before the connector goes live.
 */
public final class SaintScheduleParser {

    private static final String ROWS_SELECTOR = "tbody[id$=-contentTBody] tr[rt=1]";
    private static final String PERIOD_CELL_SELECTOR = "td[role=gridcell][cc=0]";
    private static final String LECTURE_TEXT_SELECTOR = "span.lsTextView--wrap";
    private static final String EMPTY_CELL_SELECTOR = "div.lsSTEmptyRow";
    private static final int MIN_LECTURE_LINES = 4;

    private static final Pattern PERIOD_NUMBER = Pattern.compile("(\\d+)\\s*교시");
    private static final Pattern YEAR_NUMBER = Pattern.compile("(\\d{4})학년도");

    // ISO DayOfWeek: 월=1 .. 일=7. u-SAINT cc=1..6 -> 월..토.
    private static final Map<Integer, DayMapping> CC_MAPPING = Map.of(
            1, new DayMapping(1, "월"),
            2, new DayMapping(2, "화"),
            3, new DayMapping(3, "수"),
            4, new DayMapping(4, "목"),
            5, new DayMapping(5, "금"),
            6, new DayMapping(6, "토")
    );

    private SaintScheduleParser() {
    }

    /**
     * Reads the {@code 학년도} dropdown value (e.g., "2025학년도") and
     * returns the four-digit year. Anchors on the {@code <label>} whose
     * text is exactly "학년도" so the WDxxxx ids may shift across renders
     * without breaking us. Returns -1 when the anchor is missing — that
     * happens on the minimal timetable-only fragment fixtures, in which
     * case the caller falls back to the value it already has.
     */
    public static int parseDisplayedYear(String html) {
        String value = readLabeledInputValue(html, "학년도");
        if (value == null) {
            return -1;
        }
        Matcher matcher = YEAR_NUMBER.matcher(value);
        if (!matcher.find()) {
            return -1;
        }
        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }

    /**
     * Reads the {@code 학기} dropdown value ("1학기" / "여름학기" / "2학기"
     * / "겨울학기") and returns the cycle position 1..4. Returns -1 when
     * either the anchor is missing or the label is not one of the four
     * known values — callers fall back to the previous step's term in
     * that case.
     */
    public static int parseDisplayedTerm(String html) {
        String value = readLabeledInputValue(html, "학기");
        if (value == null) {
            return -1;
        }
        return switch (value.trim()) {
            case "1학기" -> 1;
            case "여름학기" -> 2;
            case "2학기" -> 3;
            case "겨울학기" -> 4;
            default -> -1;
        };
    }

    private static String readLabeledInputValue(String html, String labelText) {
        if (html == null || html.isBlank()) {
            return null;
        }
        Document document = Jsoup.parse(html);
        for (Element label : document.select("label[for]")) {
            String text = label.text() == null ? "" : label.text().trim();
            if (!labelText.equals(text)) {
                continue;
            }
            String inputId = label.attr("for");
            if (inputId.isEmpty()) {
                continue;
            }
            Element input = document.getElementById(inputId);
            if (input == null) {
                continue;
            }
            String value = input.attr("value");
            if (value == null || value.isBlank()) {
                continue;
            }
            return value;
        }
        return null;
    }

    public static List<ScheduleEntry> parse(String html) {
        if (html == null || html.isBlank()) {
            return List.of();
        }
        Document document = Jsoup.parse(html);
        Elements rows = document.select(ROWS_SELECTOR);
        List<ScheduleEntry> entries = new ArrayList<>();

        for (Element row : rows) {
            int period = readPeriod(row);
            if (period < 1) {
                continue;
            }
            for (Map.Entry<Integer, DayMapping> mapping : CC_MAPPING.entrySet()) {
                int cc = mapping.getKey();
                Element cell = row.selectFirst("td[role=gridcell][cc=" + cc + "]");
                if (cell == null) {
                    continue;
                }
                if (cell.selectFirst(EMPTY_CELL_SELECTOR) != null) {
                    continue;
                }
                Element lectureSpan = cell.selectFirst(LECTURE_TEXT_SELECTOR);
                if (lectureSpan == null) {
                    continue;
                }
                List<String> lines = splitLines(lectureSpan);
                if (lines.size() < MIN_LECTURE_LINES) {
                    continue;
                }
                DayMapping day = mapping.getValue();
                entries.add(new ScheduleEntry(
                        day.dayOfWeek(),
                        day.label(),
                        period,
                        lines.get(2),
                        lines.get(0),
                        lines.get(1),
                        lines.get(3)
                ));
            }
        }
        return entries;
    }

    private static int readPeriod(Element row) {
        Element periodCell = row.selectFirst(PERIOD_CELL_SELECTOR);
        if (periodCell == null) {
            return -1;
        }
        Element span = periodCell.selectFirst(LECTURE_TEXT_SELECTOR);
        String text = span != null ? span.text() : periodCell.text();
        Matcher matcher = PERIOD_NUMBER.matcher(text);
        if (!matcher.find()) {
            return -1;
        }
        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }

    private static List<String> splitLines(Element lectureSpan) {
        // Jsoup .text() collapses <br>; .wholeText() preserves the original
        // newline boundaries (and the <br>s have been normalized to "\n"
        // by the parser at this point).
        String wholeText = lectureSpan.wholeText();
        if (wholeText == null || wholeText.isBlank()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (String segment : wholeText.split("\\r?\\n")) {
            String trimmed = segment.trim();
            if (!trimmed.isEmpty()) {
                lines.add(trimmed);
            }
        }
        if (!lines.isEmpty()) {
            return lines;
        }
        // Fallback for browsers/parsers that leave the <br> tags intact:
        // split on the literal tag.
        return Arrays.stream(lectureSpan.html().split("(?i)<br[^>]*>"))
                .map(part -> Jsoup.parse(part).text().trim())
                .filter(part -> !part.isEmpty())
                .toList();
    }

    private record DayMapping(int dayOfWeek, String label) {
    }
}

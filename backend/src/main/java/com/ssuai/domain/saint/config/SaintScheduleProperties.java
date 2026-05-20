package com.ssuai.domain.saint.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the realtime u-SAINT schedule fetcher (Task 16 PR 16b).
 *
 * <p>{@code timetableUrl} points at the SAP WebDynpro ZCMW2102 component
 * on {@code ecc.ssu.ac.kr} (port 443 / standard HTTPS). MYSAPSSO2 from the
 * u-SAINT portal is trusted by the ECC system, which creates an authenticated
 * USER session. Direct access to {@code hana-prd-ap-4.ssu.ac.kr:8443} was
 * tried previously but HANA does not trust the portal's SSO2 ticket and
 * creates an anonymous session instead. rusaint confirms the correct URL:
 * {@code https://ecc.ssu.ac.kr/sap/bc/webdynpro/SAP/ZCMW2102}.
 *
 * <p>{@code timeout} caps both connect and read for a single SAP hop.
 * The cumulative-year iterate can fire up to ~5 POSTs back-to-back, so
 * we set this lower than the {@code ssuai.saint.session.ttl} (30 m) by
 * a wide margin to avoid stranding a half-finished iterate.
 */
@Component
@ConfigurationProperties(prefix = "ssuai.saint.schedule")
public class SaintScheduleProperties {

    private String timetableUrl =
            "https://ecc.ssu.ac.kr/sap/bc/webdynpro/SAP/ZCMW2102?sap-client=100&sap-language=KO";
    private Duration timeout = Duration.ofSeconds(15);

    public String getTimetableUrl() {
        return timetableUrl;
    }

    public void setTimetableUrl(String timetableUrl) {
        this.timetableUrl = timetableUrl;
    }

    public Duration getTimeout() {
        return timeout;
    }

    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }
}

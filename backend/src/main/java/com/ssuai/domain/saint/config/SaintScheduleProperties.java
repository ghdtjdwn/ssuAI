package com.ssuai.domain.saint.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the realtime u-SAINT schedule fetcher (Task 16 PR 16b).
 *
 * <p>{@code timetableUrl} is the direct fallback for the SAP WebDynpro
 * ZCMW2102 component. In prod, {@code portalUrl} should be set so the
 * connector first resolves the portal-issued {@code ;sap-ext-sid=...}
 * entry URL from saint.ssu.ac.kr and enters ECC through that URL.
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
            "https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMW2102";
    private String portalUrl = "";
    private Duration timeout = Duration.ofSeconds(15);

    public String getTimetableUrl() {
        return timetableUrl;
    }

    public void setTimetableUrl(String timetableUrl) {
        this.timetableUrl = timetableUrl;
    }

    public String getPortalUrl() {
        return portalUrl;
    }

    public void setPortalUrl(String portalUrl) {
        this.portalUrl = portalUrl;
    }

    public Duration getTimeout() {
        return timeout;
    }

    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }
}

package com.ssuai.domain.saint.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the realtime u-SAINT grades fetcher (Task 16 PR 16c).
 *
 * <p>{@code gradesUrl} is the direct fallback for the SAP WebDynpro
 * ZCMB3W0017 component. In prod, {@code portalUrl} should be set so the
 * connector first resolves the portal-issued {@code ;sap-ext-sid=...}
 * entry URL from saint.ssu.ac.kr and enters ECC through that URL.
 *
 * <p>{@code timeout} caps both connect and read for a single SAP hop.
 * The previous-term iterate fires one POST per prior term reached from
 * the term history, so the worst-case grades fetch is on the order of
 * 10-15 hops. Keep this well under the SaintSessionStore TTL.
 */
@Component
@ConfigurationProperties(prefix = "ssuai.saint.grades")
public class SaintGradesProperties {

    private String gradesUrl =
            "https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMB3W0017";
    private String portalUrl = "";
    private Duration timeout = Duration.ofSeconds(15);

    public String getGradesUrl() {
        return gradesUrl;
    }

    public void setGradesUrl(String gradesUrl) {
        this.gradesUrl = gradesUrl;
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

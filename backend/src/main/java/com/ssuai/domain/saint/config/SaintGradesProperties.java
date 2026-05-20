package com.ssuai.domain.saint.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the realtime u-SAINT grades fetcher (Task 16 PR 16c).
 *
 * <p>{@code gradesUrl} points at the SAP WebDynpro ZCMB3W0017 component
 * on {@code ecc.ssu.ac.kr} (port 443 / standard HTTPS). MYSAPSSO2 from the
 * u-SAINT portal is trusted by the ECC system. The previous default targeting
 * {@code hana-prd-ap-4.ssu.ac.kr:8443} created anonymous sessions because
 * HANA does not trust the portal's SSO2 ticket.
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
            "https://ecc.ssu.ac.kr/sap/bc/webdynpro/SAP/ZCMB3W0017?sap-client=100&sap-language=KO";
    private Duration timeout = Duration.ofSeconds(15);

    public String getGradesUrl() {
        return gradesUrl;
    }

    public void setGradesUrl(String gradesUrl) {
        this.gradesUrl = gradesUrl;
    }

    public Duration getTimeout() {
        return timeout;
    }

    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }
}

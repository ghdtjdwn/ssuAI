package com.ssuai.domain.saint.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the realtime u-SAINT grades fetcher (Task 16 PR 16c).
 *
 * <p>{@code gradesUrl} points at the SAP WebDynpro ZCMB3W0017 component
 * on {@code hana-prd-ap-4.ssu.ac.kr:8443} (the HANA application server).
 * {@code ecc.ssu.ac.kr} is a portal router that uses JavaScript redirect,
 * not an HTTP redirect, so the connector must target the app server directly.
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
            "https://hana-prd-ap-4.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMB3W0017?sap-client=100&sap-language=KO";
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

package com.ssuai.domain.saint.connector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PortalNavigationServiceTests {

    @Test
    void extractsPortalIssuedSapExtSidFromIframeSrc() {
        String html = """
                <html><body>
                  <iframe src="https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMW2102;sap-ext-sid=SID-123"></iframe>
                </body></html>
                """;

        assertThat(PortalNavigationService.extractEntryUrl(
                html,
                "ZCMW2102",
                "https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMW2102"))
                .contains("https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMW2102;sap-ext-sid=SID-123");
    }

    @Test
    void prefersSapExtSidUrlAndNormalizesEccHostTo8443() {
        String html = """
                <html><body>
                  <a href="https://ecc.ssu.ac.kr/sap/bc/webdynpro/SAP/ZCMB3W0017">direct</a>
                  <iframe src="https://ecc.ssu.ac.kr/sap/bc/webdynpro/SAP/ZCMB3W0017;sap-ext-sid=SID-G"></iframe>
                </body></html>
                """;

        assertThat(PortalNavigationService.extractEntryUrl(
                html,
                "ZCMB3W0017",
                "https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMB3W0017"))
                .contains("https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMB3W0017;sap-ext-sid=SID-G");
    }

    @Test
    void decodesJavascriptEscapedEntryUrl() {
        String html = """
                <script>
                  var target = "https:\\/\\/ecc.ssu.ac.kr\\/sap\\/bc\\/webdynpro\\/SAP\\/ZCMW2102;sap-ext-sid=SID-JS";
                </script>
                """;

        assertThat(PortalNavigationService.extractEntryUrl(
                html,
                "ZCMW2102",
                "https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMW2102"))
                .contains("https://ecc.ssu.ac.kr:8443/sap/bc/webdynpro/SAP/ZCMW2102;sap-ext-sid=SID-JS");
    }
}

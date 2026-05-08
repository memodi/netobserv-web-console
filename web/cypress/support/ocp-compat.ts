/**
 * OCP version compatibility layer for handling minor differences
 * within the same PatternFly major version.
 *
 * Note: This file handles OCP-specific quirks, NOT PatternFly version differences.
 * PatternFly version differences should be handled via separate branches.
 */

export class OCPCompat {
  private ocpVersion: string;
  private ocpMajorMinor: number;

  constructor() {
    this.ocpVersion = this.getOCPVersion();
    this.ocpMajorMinor = parseFloat(this.ocpVersion);
  }

  private getOCPVersion(): string {
    // Try to get from environment variable first
    const envVersion = Cypress.env('OCP_VERSION');
    if (envVersion) {
      return String(envVersion);
    }

    // Default to latest if not specified
    return '4.20';
  }

  /**
   * Get the Administrator perspective name based on OCP version
   * 4.18 and below: "Administrator"
   * 4.19+: "Core platform"
   */
  getAdministratorPerspective(): string {
    return this.ocpMajorMinor <= 4.18 ? 'Administrator' : 'Core platform';
  }

  /**
   * Get refresh interval dropdown selector based on OCP version
   * 4.18 and below: '#refresh-interval-dropdown-dropdown'
   * 4.19+: 'label[for="refresh-interval-dropdown"]' (with parent navigation)
   */
  getRefreshIntervalSelector(): { selector: string; needsParentNav: boolean } {
    if (this.ocpMajorMinor <= 4.18) {
      return {
        selector: '#refresh-interval-dropdown-dropdown',
        needsParentNav: false
      };
    }
    return {
      selector: 'label[for="refresh-interval-dropdown"]',
      needsParentNav: true
    };
  }

  /**
   * Get time range dropdown selector based on OCP version
   * 4.18 and below: '#monitoring-time-range-dropdown-dropdown'
   * 4.19+: 'label[for="monitoring-time-range-dropdown"]' (with parent navigation)
   */
  getTimeRangeSelector(): { selector: string; needsParentNav: boolean } {
    if (this.ocpMajorMinor <= 4.18) {
      return {
        selector: '#monitoring-time-range-dropdown-dropdown',
        needsParentNav: false
      };
    }
    return {
      selector: 'label[for="monitoring-time-range-dropdown"]',
      needsParentNav: true
    };
  }

  /**
   * Check if feature is available in this OCP version
   */
  hasFeature(feature: string): boolean {
    const featureMatrix: Record<string, boolean> = {
      'udn': this.ocpMajorMinor >= 4.20,
      'gateway-api': this.ocpMajorMinor >= 4.19,
      'zone-multicluster': this.ocpMajorMinor >= 4.17,
      'dns-tracking': this.ocpMajorMinor >= 4.16,
    };
    return featureMatrix[feature] || false;
  }

  /**
   * Check if workaround is needed for known bugs
   */
  needsWorkaround(bugId: string): boolean {
    const workarounds: Record<string, boolean> = {
      // OCPBUGS-58468: Cluster admin group test issue
      'OCPBUGS-58468': this.ocpMajorMinor >= 4.18,
    };
    return workarounds[bugId] || false;
  }

  /**
   * Get current OCP version string
   */
  getVersion(): string {
    return this.ocpVersion;
  }

  /**
   * Get current OCP version as number (major.minor)
   */
  getVersionNumber(): number {
    return this.ocpMajorMinor;
  }
}

// Singleton instance
const ocpCompat = new OCPCompat();

export default ocpCompat;

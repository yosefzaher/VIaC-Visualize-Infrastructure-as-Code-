/**
 * VIaC – AWS Region → Availability Zone Mapping
 *
 * Maps each AWS region to its available AZs.
 * Used by the Properties Panel to show context-aware AZ dropdowns
 * and by the validation engine to detect AZ-Region mismatches.
 */

export const REGION_AZ_MAP = {
  "us-east-1": ["us-east-1a", "us-east-1b", "us-east-1c", "us-east-1d", "us-east-1e", "us-east-1f"],
  "us-east-2": ["us-east-2a", "us-east-2b", "us-east-2c"],
  "us-west-1": ["us-west-1a", "us-west-1b"],
  "us-west-2": ["us-west-2a", "us-west-2b", "us-west-2c", "us-west-2d"],
  "ca-central-1": ["ca-central-1a", "ca-central-1b", "ca-central-1d"],
  "eu-west-1": ["eu-west-1a", "eu-west-1b", "eu-west-1c"],
  "eu-west-2": ["eu-west-2a", "eu-west-2b", "eu-west-2c"],
  "eu-west-3": ["eu-west-3a", "eu-west-3b", "eu-west-3c"],
  "eu-central-1": ["eu-central-1a", "eu-central-1b", "eu-central-1c"],
  "eu-central-2": ["eu-central-2a", "eu-central-2b", "eu-central-2c"],
  "eu-north-1": ["eu-north-1a", "eu-north-1b", "eu-north-1c"],
  "eu-south-1": ["eu-south-1a", "eu-south-1b", "eu-south-1c"],
  "ap-east-1": ["ap-east-1a", "ap-east-1b", "ap-east-1c"],
  "ap-south-1": ["ap-south-1a", "ap-south-1b", "ap-south-1c"],
  "ap-south-2": ["ap-south-2a", "ap-south-2b", "ap-south-2c"],
  "ap-southeast-1": ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"],
  "ap-southeast-2": ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"],
  "ap-northeast-1": ["ap-northeast-1a", "ap-northeast-1c", "ap-northeast-1d"],
  "ap-northeast-2": ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c", "ap-northeast-2d"],
  "ap-northeast-3": ["ap-northeast-3a", "ap-northeast-3b", "ap-northeast-3c"],
  "sa-east-1": ["sa-east-1a", "sa-east-1b", "sa-east-1c"],
  "me-south-1": ["me-south-1a", "me-south-1b", "me-south-1c"],
  "me-central-1": ["me-central-1a", "me-central-1b", "me-central-1c"],
  "af-south-1": ["af-south-1a", "af-south-1b", "af-south-1c"],
};

/** All region keys for dropdowns */
export const ALL_REGIONS = Object.keys(REGION_AZ_MAP);

/**
 * Get valid AZs for a given region.
 * @param {string} region
 * @returns {string[]}
 */
export function getAZsForRegion(region) {
  return REGION_AZ_MAP[region] || [];
}

/**
 * Check if an AZ belongs to a given region.
 * @param {string} az    e.g. "us-east-1a"
 * @param {string} region e.g. "us-east-1"
 * @returns {boolean}
 */
export function isAZValidForRegion(az, region) {
  if (!az || !region) return true; // No AZ set yet → not invalid
  const validAZs = REGION_AZ_MAP[region];
  if (!validAZs) return true; // Unknown region → skip validation
  return validAZs.includes(az);
}

/**
 * Extract the region from an AZ string.
 * e.g. "us-east-1a" → "us-east-1"
 */
export function regionFromAZ(az) {
  if (!az) return null;
  // Remove trailing letter(s) after the last dash+digit
  return az.replace(/[a-z]$/, "");
}

/**
 * VIaC – Canvas Validation Engine
 *
 * Validates the canvas state and returns a list of errors.
 * Used to:
 *  1. Show visual error states on nodes (red border)
 *  2. Block Plan/Apply when errors exist
 */

import { isAZValidForRegion } from "../config/regionData";

/**
 * Find the parent Region's label for a given node by walking up the
 * parentId chain.
 *
 * @param {object} node    – The node to check
 * @param {Map}    nodeMap – Map of nodeId → node
 * @returns {string|null}  – The region label (e.g. "us-east-1") or null
 */
function findParentRegion(node, nodeMap) {
  let current = node;
  while (current?.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) break;
    if (parent.data?.resourceType === "aws_region") {
      return parent.data?.properties?.label || null;
    }
    current = parent;
  }
  return null;
}

/**
 * Validate all nodes on the canvas.
 *
 * @param {object[]} nodes – React Flow nodes
 * @returns {{ errors: Map<string, string[]>, hasErrors: boolean }}
 *   errors: Map of nodeId → array of error messages
 */
export function validateCanvas(nodes) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const errors = new Map();

  for (const node of nodes) {
    const nodeErrors = [];
    const resourceType = node.data?.resourceType;

    // ── AZ-Region validation for Subnets ────────────────────
    if (resourceType === "aws_subnet") {
      const az = node.data?.properties?.availability_zone;
      const parentRegion = findParentRegion(node, nodeMap);

      if (parentRegion && az) {
        if (!isAZValidForRegion(az, parentRegion)) {
          nodeErrors.push(
            `AZ "${az}" does not belong to region "${parentRegion}". ` +
            `Valid AZs: ${parentRegion}a, ${parentRegion}b, ...`
          );
        }
      }
    }

    // ── SG rules validation ─────────────────────────────────
    if (resourceType === "aws_security_group") {
      const rules = node.data?.properties?.ingress_rules || [];
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule.from_port && rule.from_port !== 0) {
          nodeErrors.push(`Ingress rule #${i + 1}: Port is required`);
        }
        if (!rule.cidr_blocks && !rule.source_security_group) {
          nodeErrors.push(`Ingress rule #${i + 1}: Source (CIDR or SG ref) is required`);
        }
      }
    }

    if (nodeErrors.length > 0) {
      errors.set(node.id, nodeErrors);
    }
  }

  return { errors, hasErrors: errors.size > 0 };
}

/**
 * VIaC – Canvas Validation Engine
 *
 * Validates the canvas state and returns a list of errors.
 * Used to:
 *  1. Show visual error states on nodes (red border)
 *  2. Block Plan/Apply when errors exist
 */

import { isAZValidForRegion } from "../config/regionData";
import NODE_CONFIG from "../config/nodeConfig";

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

// If parentId-based lookup fails, attempt spatial containment detection.
function findParentRegionByPosition(node, nodeMap) {
  // Compute absolute position of a node by walking parent chain
  const computeAbs = (n) => {
    let x = n.position?.x || 0;
    let y = n.position?.y || 0;
    let cur = n;
    while (cur?.parentId) {
      const p = nodeMap.get(cur.parentId);
      if (!p) break;
      x += p.position?.x || 0;
      y += p.position?.y || 0;
      cur = p;
    }
    return { x, y };
  };

  const nodeAbs = computeAbs(node);

  const candidates = [];
  for (const [, candidate] of nodeMap) {
    if (candidate.data?.resourceType !== "aws_region") continue;

    // Determine width/height (prefer measured/width/style, fallback to NODE_CONFIG)
    const cfg = NODE_CONFIG[candidate.data?.resourceType] || {};
    const rawW = candidate.width || candidate.measured?.width || candidate.style?.width;
    const rawH = candidate.height || candidate.measured?.height || candidate.style?.height;
    const w = typeof rawW === "string" ? parseInt(rawW, 10) : rawW || cfg.minWidth || 400;
    const h = typeof rawH === "string" ? parseInt(rawH, 10) : rawH || cfg.minHeight || 300;

    const abs = computeAbs(candidate);
    const absX = abs.x;
    const absY = abs.y;

    if (
      nodeAbs.x >= absX &&
      nodeAbs.x <= absX + w &&
      nodeAbs.y >= absY &&
      nodeAbs.y <= absY + h
    ) {
      // compute depth for tie-breaking
      let depth = 0;
      let cur = candidate;
      while (cur?.parentId) {
        const p = nodeMap.get(cur.parentId);
        if (!p) break;
        depth += 1;
        cur = p;
      }
      candidates.push({ candidate, depth, area: w * h });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return a.area - b.area;
  });

  const chosen = candidates[0].candidate;
  return chosen.data?.properties?.label || null;
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
      // Try parentId chain first, then spatial containment as fallback
      const parentRegion = findParentRegion(node, nodeMap) || findParentRegionByPosition(node, nodeMap);

      if (parentRegion && az) {
        if (!isAZValidForRegion(az, parentRegion)) {
          nodeErrors.push(
            `AZ "${az}" does not belong to region "${parentRegion}". ` +
            `Valid AZs: ${parentRegion}a, ${parentRegion}b, ...`
          );
        }
      }
      // If no parentRegion but AZ is set, still warn the user that region is unknown
      if (!parentRegion && az) {
        nodeErrors.push(`No parent Region detected for Subnet with AZ "${az}".`);
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

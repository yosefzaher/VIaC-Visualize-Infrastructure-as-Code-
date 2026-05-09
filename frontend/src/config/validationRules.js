/**
 * VIaC – Connection Validation Rules
 *
 * Defines which resource types can connect to which, and what
 * property the connection sets on the target resource.
 *
 * Format:
 *   VALID_CONNECTIONS[targetType] = [
 *     { source: "source_resource_type", property: "target_property_name" }
 *   ]
 *
 * The isValidConnection function checks these rules at connection time.
 */

import { TYPE_TO_RESOURCE } from "./nodeConfig";

/**
 * Map of target_resource_type → allowed incoming connections.
 */
export const VALID_CONNECTIONS = {
  // Subnet MUST connect from a VPC
  aws_subnet: [
    { source: "aws_vpc", property: "vpc_id" },
  ],

  // EC2 connects from a Subnet (subnet_id) and optionally SGs
  aws_instance: [
    { source: "aws_subnet", property: "subnet_id" },
    { source: "aws_security_group", property: "vpc_security_group_ids" },
  ],

  // Security Group connects from a VPC
  aws_security_group: [
    { source: "aws_vpc", property: "vpc_id" },
  ],

  // Internet Gateway connects from a VPC
  aws_internet_gateway: [
    { source: "aws_vpc", property: "vpc_id" },
  ],

  // Route Table connects from a VPC
  aws_route_table: [
    { source: "aws_vpc", property: "vpc_id" },
  ],

  // Route connects from a Route Table and an IGW (or NAT)
  aws_route: [
    { source: "aws_route_table", property: "route_table_id" },
    { source: "aws_internet_gateway", property: "gateway_id" },
  ],

  // Route Table Association connects from a Subnet and a Route Table
  aws_route_table_association: [
    { source: "aws_subnet", property: "subnet_id" },
    { source: "aws_route_table", property: "route_table_id" },
  ],
};

/**
 * Check if a proposed connection is valid.
 *
 * @param {object} connection - React Flow connection object
 * @param {object[]} nodes    - Current nodes array
 * @returns {boolean}
 */
export function isValidConnection(connection, nodes) {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) return false;

  const sourceResource = sourceNode.data?.resourceType;
  const targetResource = targetNode.data?.resourceType;

  if (!sourceResource || !targetResource) return false;

  // No self-connections
  if (connection.source === connection.target) return false;

  // Check rules
  const rules = VALID_CONNECTIONS[targetResource];
  if (!rules) return false;

  return rules.some((rule) => rule.source === sourceResource);
}

/**
 * Given a source resource type and target resource type,
 * return the property name the connection should set.
 */
export function getConnectionProperty(sourceResource, targetResource) {
  const rules = VALID_CONNECTIONS[targetResource] || [];
  const rule = rules.find((r) => r.source === sourceResource);
  return rule?.property || null;
}

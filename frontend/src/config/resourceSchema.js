/**
 * Central resource schemas for dynamic PropertiesPanel rendering.
 *
 * Each resource entry defines a list of fields that contain:
 *  - key: property key in node.data.properties
 *  - label: UI label
 *  - type: logical type (string, number, boolean, array, object, reference)
 *  - widget: UI widget hint (text, number, select, multi, resourcePicker, array)
 *
 * The schema is intentionally lightweight and UI-oriented; validation
 * rules and stricter typing can be added later or shared with the backend.
 */

import { ALL_REGIONS } from "./regionData";

const RESOURCE_SCHEMA = {
  aws_region: {
    label: "Region",
    fields: [
      { key: "label", label: "Label", type: "string", widget: "select", options: ALL_REGIONS, default: "us-east-1" },
    ],
  },

  aws_security_group: {
    label: "Security Group",
    fields: [
      { key: "name", label: "Name", type: "string", widget: "text", required: true },
      { key: "description", label: "Description", type: "string", widget: "text" },
      { key: "vpc_id", label: "VPC", type: "reference", widget: "resourcePicker", resourceType: "aws_vpc" },

      // Ingress rules (array of objects)
      {
        key: "ingress_rules",
        label: "Inbound Rules",
        type: "array",
        widget: "array",
        itemSchema: {
          // default item used when adding a new rule
          defaults: { type: "SSH", protocol: "tcp", from_port: 22, to_port: 22, cidr_blocks: ["0.0.0.0/0"], description: "" },
          // fields for each rule object
          fields: [
            { key: "type", label: "Preset", type: "string", widget: "select", options: ["SSH", "HTTP", "HTTPS", "RDP", "MySQL", "PostgreSQL", "All Traffic", "Custom"] },
            { key: "protocol", label: "Protocol", type: "string", widget: "select", options: ["tcp", "udp", "icmp", "-1"] },
            { key: "from_port", label: "From Port", type: "number", widget: "number" },
            { key: "to_port", label: "To Port", type: "number", widget: "number" },
            { key: "cidr_blocks", label: "CIDR Blocks", type: "array", widget: "multi", itemType: "string", default: ["0.0.0.0/0"] },
            { key: "description", label: "Description", type: "string", widget: "text" },
            { key: "source_security_group", label: "Source SG", type: "reference", widget: "resourcePicker", resourceType: "aws_security_group" },
          ],
          // presets map for quick auto-fill (applied when the `type` field changes)
          presets: {
            SSH: { protocol: "tcp", from_port: 22, to_port: 22 },
            HTTP: { protocol: "tcp", from_port: 80, to_port: 80 },
            HTTPS: { protocol: "tcp", from_port: 443, to_port: 443 },
            RDP: { protocol: "tcp", from_port: 3389, to_port: 3389 },
            MySQL: { protocol: "tcp", from_port: 3306, to_port: 3306 },
            PostgreSQL: { protocol: "tcp", from_port: 5432, to_port: 5432 },
            "All Traffic": { protocol: "-1", from_port: 0, to_port: 0 },
            Custom: { protocol: "tcp", from_port: 0, to_port: 0 },
          },
        },
      },

      // Egress rules (array of objects)
      {
        key: "egress_rules",
        label: "Outbound Rules",
        type: "array",
        widget: "array",
        itemSchema: {
          defaults: { protocol: "-1", from_port: 0, to_port: 0, cidr_blocks: ["0.0.0.0/0"], description: "" },
          fields: [
            { key: "protocol", label: "Protocol", type: "string", widget: "select", options: ["tcp", "udp", "icmp", "-1"] },
            { key: "from_port", label: "From Port", type: "number", widget: "number" },
            { key: "to_port", label: "To Port", type: "number", widget: "number" },
            { key: "cidr_blocks", label: "CIDR Blocks", type: "array", widget: "multi", itemType: "string", default: ["0.0.0.0/0"] },
            { key: "description", label: "Description", type: "string", widget: "text" },
          ],
        },
      },

      { key: "environment", label: "Environment", type: "string", widget: "text", default: "dev" },
      { key: "tags", label: "Tags", type: "object", widget: "keyValue" },
    ],
  },
};

export default RESOURCE_SCHEMA;

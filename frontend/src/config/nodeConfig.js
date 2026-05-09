/**
 * VIaC – Node Configuration Registry
 *
 * Central source of truth for every resource type the canvas supports.
 * Each entry defines: label, icon, color, default properties,
 * whether it can act as a group (parent), and which handle positions
 * it exposes.
 */

import {
  RegionIcon, VpcIcon, SubnetIcon, Ec2Icon,
  SecurityGroupIcon, IgwIcon, RouteTableIcon,
  RouteIcon, RouteAssocIcon,
} from "../components/icons/AwsIcons";

const NODE_CONFIG = {
  aws_region: {
    label: "Region",
    type: "regionNode",
    iconComponent: RegionIcon,
    color: "var(--color-node-region)",
    isGroup: true,
    isBackendResource: false,   // regions are not sent as resources
    defaults: { label: "us-east-1" },
    handles: { source: false, target: false },
    minWidth: 600,
    minHeight: 400,
  },

  aws_vpc: {
    label: "VPC",
    type: "vpcNode",
    iconComponent: VpcIcon,
    color: "var(--color-node-vpc)",
    isGroup: true,
    isBackendResource: true,
    defaults: { name: "my-vpc", cidr: "10.0.0.0/16", environment: "dev" },
    handles: { source: true, target: true },
    minWidth: 450,
    minHeight: 300,
  },

  aws_subnet: {
    label: "Subnet",
    type: "subnetNode",
    iconComponent: SubnetIcon,
    color: "var(--color-node-subnet)",
    isGroup: true,
    isBackendResource: true,
    defaults: {
      name: "my-subnet",
      cidr: "10.0.1.0/24",
      availability_zone: "us-east-1a",
      public: true,
    },
    handles: { source: true, target: true },
    minWidth: 300,
    minHeight: 200,
  },

  aws_instance: {
    label: "EC2 Instance",
    type: "ec2Node",
    iconComponent: Ec2Icon,
    color: "var(--color-node-ec2)",
    isGroup: false,
    isBackendResource: true,
    defaults: {
      name: "my-instance",
      ami: "ami-0c02fb55956c7d316",
      instance_type: "t2.micro",
      associate_public_ip: true,
    },
    handles: { source: true, target: true },
  },

  aws_security_group: {
    label: "Security Group",
    type: "sgNode",
    iconComponent: SecurityGroupIcon,
    color: "var(--color-node-sg)",
    isGroup: false,
    isBackendResource: true,
    defaults: {
      name: "my-sg",
      description: "Managed by VIaC",
      ingress_rules: [
        { type: "SSH",  protocol: "tcp", from_port: 22, to_port: 22, cidr_blocks: "0.0.0.0/0", description: "SSH access" },
        { type: "HTTP", protocol: "tcp", from_port: 80, to_port: 80, cidr_blocks: "0.0.0.0/0", description: "HTTP access" },
      ],
      egress_rules: [
        { type: "All Traffic", protocol: "-1", from_port: 0, to_port: 0, cidr_blocks: "0.0.0.0/0", description: "Allow all outbound" },
      ],
    },
    handles: { source: true, target: true },
  },

  aws_internet_gateway: {
    label: "Internet Gateway",
    type: "igwNode",
    iconComponent: IgwIcon,
    color: "var(--color-node-igw)",
    isGroup: false,
    isBackendResource: true,
    defaults: { name: "my-igw" },
    handles: { source: true, target: true },
  },

  aws_route_table: {
    label: "Route Table",
    type: "rtNode",
    iconComponent: RouteTableIcon,
    color: "var(--color-node-rt)",
    isGroup: false,
    isBackendResource: true,
    defaults: { name: "my-rt" },
    handles: { source: true, target: true },
  },

  aws_route: {
    label: "Route",
    type: "routeNode",
    iconComponent: RouteIcon,
    color: "var(--color-node-route)",
    isGroup: false,
    isBackendResource: true,
    defaults: { destination_cidr: "0.0.0.0/0" },
    handles: { source: true, target: true },
  },

  aws_route_table_association: {
    label: "RT Association",
    type: "rtaNode",
    iconComponent: RouteAssocIcon,
    color: "var(--color-node-rta)",
    isGroup: false,
    isBackendResource: true,
    defaults: {},
    handles: { source: true, target: true },
  },
};

/** Quick lookup: react flow node type string → resource type key */
export const TYPE_TO_RESOURCE = Object.fromEntries(
  Object.entries(NODE_CONFIG).map(([key, cfg]) => [cfg.type, key])
);

export default NODE_CONFIG;

/**
 * VIaC – AWS Service Icon Components
 *
 * Professional SVG icons for each AWS resource type.
 * Each icon accepts `size` and `className` props.
 */

const defaultSize = 24;

export function RegionIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.2" />
      <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="0.8" />
      <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

export function VpcIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 8h20" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 14h-3M15 14h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function SubnetIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
      <rect x="7" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Ec2Icon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="6" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M10 10h4M10 12h2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function SecurityGroupIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IgwIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 8l4-3 4 3M8 16l4 3 4-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RouteTableIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h18M3 13h18M9 8v13" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="6" cy="10.5" r="1" fill="currentColor" />
      <circle cx="6" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function RouteIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 18h4l4-6 4 3h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 15l2-2-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function RouteAssocIcon({ size = defaultSize, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="8" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="14" y="8" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  );
}

export const ICON_MAP = {
  aws_region: RegionIcon,
  aws_vpc: VpcIcon,
  aws_subnet: SubnetIcon,
  aws_instance: Ec2Icon,
  aws_security_group: SecurityGroupIcon,
  aws_internet_gateway: IgwIcon,
  aws_route_table: RouteTableIcon,
  aws_route: RouteIcon,
  aws_route_table_association: RouteAssocIcon,
};

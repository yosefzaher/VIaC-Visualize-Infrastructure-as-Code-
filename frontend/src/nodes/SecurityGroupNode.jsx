import BaseNode from "./BaseNode";

export default function SecurityGroupNode(props) {
  const { data } = props;
  const desc = data?.properties?.description || "Managed by VIaC";
  const ingressCount = data?.properties?.ingress_rules?.length || 0;
  const egressCount = data?.properties?.egress_rules?.length || 0;

  return (
    <BaseNode {...props}>
      <div className="space-y-0.5">
        <span>{desc}</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-emerald-400">⬇ {ingressCount} inbound</span>
          <span className="text-amber-400">⬆ {egressCount} outbound</span>
        </div>
      </div>
    </BaseNode>
  );
}

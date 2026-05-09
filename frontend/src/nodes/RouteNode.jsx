import BaseNode from "./BaseNode";
export default function RouteNode(props) {
  const cidr = props.data?.properties?.destination_cidr || "0.0.0.0/0";
  return (
    <BaseNode {...props}>
      <span className="font-mono">{cidr}</span>
    </BaseNode>
  );
}

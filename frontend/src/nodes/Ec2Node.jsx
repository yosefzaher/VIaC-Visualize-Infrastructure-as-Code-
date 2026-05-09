import BaseNode from "./BaseNode";

export default function Ec2Node(props) {
  const { data } = props;
  const instanceType = data?.properties?.instance_type || "t2.micro";
  const ami = data?.properties?.ami || "";

  return (
    <BaseNode {...props}>
      <div className="flex flex-col gap-0.5">
        <span className="font-mono">{instanceType}</span>
        {ami && <span className="truncate opacity-60">{ami}</span>}
      </div>
    </BaseNode>
  );
}

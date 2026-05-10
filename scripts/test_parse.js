const s = `Error: Invalid expression

on main.tf line 78, in resource "aws_subnet" "subnet_3":
78: vpc_id =
79: cidr_block = "10.0.1.0/24"

Expected the start of an expression, but found an invalid expression token.`;

const re = /in resource\s+"([^"]+)"\s+"([^"]+)"/g;
const m = re.exec(s);
console.log('input:\n', s);
console.log('regex:', re);
console.log('match:', m ? [m[1], m[2]] : null);

// also test substring search for type.name
const found = s.includes('aws_subnet.subnet_3');
console.log('contains aws_subnet.subnet_3?', found);

// capture Error: block
const errIdx = s.indexOf('Error:');
if (errIdx !== -1) {
  const nextBlank = s.indexOf('\n\n', errIdx);
  const block = s.substring(errIdx, nextBlank !== -1 ? nextBlank : errIdx + 400);
  console.log('error block:\n', block);
}

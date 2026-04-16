import fs from "node:fs";
import { route } from "./routing-rules.js";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const output = route(input.frameworkAssessment);
console.log(JSON.stringify(output, null, 2));

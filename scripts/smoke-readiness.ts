import "dotenv/config";

import { getReadiness } from "../src/core/readiness.js";

console.log(JSON.stringify(getReadiness(), null, 2));

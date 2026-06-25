import "dotenv/config";

import { buildCapabilities } from "../src/croo/delivery.js";

const required = ["CROO_API_URL", "CROO_WS_URL"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (!process.env.CROO_SDK_KEY?.trim() && !process.env.CROO_API_KEY?.trim()) {
  missing.push("CROO_SDK_KEY or CROO_API_KEY");
}

if (missing.length) {
  console.log(
    JSON.stringify(
      {
        ready: false,
        skipped: true,
        missing,
        message: "Live CROO smoke is skipped until credentials are configured.",
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    {
      ready: true,
      capabilities: buildCapabilities().map((capability) => ({
        id: capability.id,
        name: capability.name,
        priceUsdc: capability.priceUsdc,
      })),
      message: "Credentials are present. Start npm run croo:provider for live websocket registration.",
    },
    null,
    2
  )
);

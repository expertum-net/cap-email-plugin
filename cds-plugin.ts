import cds from "@sap/cds";
import { registerEmailHandlers } from "./lib/plugin.js";

const LOG = cds.log("email");

cds.once("served", async () => {
  LOG.info("Initializing cap-email plugin");
  await registerEmailHandlers();
  LOG.info("cap-email plugin initialized successfully");
});

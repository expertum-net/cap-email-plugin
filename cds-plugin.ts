import cds from "@sap/cds";
import { registerEmailHandlers } from "./lib/plugin.js";

cds.on("served", registerEmailHandlers);

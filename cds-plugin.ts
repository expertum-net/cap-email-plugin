import cds from "@sap/cds";
import { registerEmailHandlers } from "./lib/plugin.js";

cds.once("served", registerEmailHandlers);

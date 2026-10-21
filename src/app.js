import { createGraphController } from "./graphs/controller.js";
import { installStudio } from "./studio/index.js";

installStudio(createGraphController());

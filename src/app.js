import { installMenus } from "./menus.js";
import { createGraphController } from "./graphs/controller.js";
import { createExperimentController } from "./coil/controller.js";
import { installStudio } from "./studio/index.js";
import { installWorkspaces } from "./workspaces.js";

installMenus();
const experiment=createExperimentController(createGraphController());
const studio=installStudio(experiment);
installWorkspaces(experiment,studio);

import { installMenus } from "./menus.js";
import { createGraphController } from "./graphs/controller.js";
import { installStudio } from "./studio/index.js";

installMenus();
installStudio(createGraphController());

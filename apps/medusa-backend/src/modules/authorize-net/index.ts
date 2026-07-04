import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import AuthorizeNetProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [AuthorizeNetProviderService],
});

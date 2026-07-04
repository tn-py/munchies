export function isAuthorizeNet(providerId?: string) {
  return providerId?.startsWith("pp_authorizenet_");
}

export function isManual(providerId?: string) {
  return providerId?.startsWith("pp_system_default");
}

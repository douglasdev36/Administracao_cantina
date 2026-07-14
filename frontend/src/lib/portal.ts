export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.getElementById("portal-root") ?? document.body;
}

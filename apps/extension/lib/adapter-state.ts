// Minimal state module -- no imports from db.ts to avoid circular deps
let _serviceActive = false;

export function setServiceActive(active: boolean) {
  _serviceActive = active;
}

export function isServiceActive(): boolean {
  return _serviceActive;
}

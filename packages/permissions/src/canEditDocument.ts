export interface SessionRole {
  isHost: boolean;
  isGuest: boolean;
  guestsCanEdit: boolean;
}

export function canEditDocument(role: SessionRole): boolean {
  if (role.isHost) {
    return true;
  }
  if (role.isGuest) {
    return role.guestsCanEdit;
  }
  return false;
}

export function canSaveToFile(role: SessionRole): boolean {
  return role.isHost;
}

export function canManageSession(role: SessionRole): boolean {
  return role.isHost;
}

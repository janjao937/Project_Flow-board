import { describe, expect, it } from "vitest";
import { canEditDocument, canManageSession, canSaveToFile } from "./canEditDocument";

describe("canEditDocument", () => {
  it("host can always edit regardless of guestsCanEdit", () => {
    expect(canEditDocument({ isHost: true, isGuest: false, guestsCanEdit: false })).toBe(true);
    expect(canEditDocument({ isHost: true, isGuest: false, guestsCanEdit: true })).toBe(true);
  });

  it("guest can edit only when guestsCanEdit is true", () => {
    expect(canEditDocument({ isHost: false, isGuest: true, guestsCanEdit: true })).toBe(true);
    expect(canEditDocument({ isHost: false, isGuest: true, guestsCanEdit: false })).toBe(false);
  });

  it("neither host nor guest cannot edit", () => {
    expect(canEditDocument({ isHost: false, isGuest: false, guestsCanEdit: true })).toBe(false);
  });
});

describe("canSaveToFile", () => {
  it("only the host can save to file", () => {
    expect(canSaveToFile({ isHost: true, isGuest: false, guestsCanEdit: true })).toBe(true);
    expect(canSaveToFile({ isHost: false, isGuest: true, guestsCanEdit: true })).toBe(false);
  });
});

describe("canManageSession", () => {
  it("only the host can manage session settings", () => {
    expect(canManageSession({ isHost: true, isGuest: false, guestsCanEdit: false })).toBe(true);
    expect(canManageSession({ isHost: false, isGuest: true, guestsCanEdit: false })).toBe(false);
  });
});

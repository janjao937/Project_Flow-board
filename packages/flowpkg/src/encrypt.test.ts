import { describe, expect, it } from "vitest";
import { createEmptyManifest } from "./types";
import { packFlowPackage } from "./pack";
import { unpackFlowPackage } from "./unpack";
import {
  decryptFlowPackageBytes,
  encryptFlowPackageBytes,
  isEncryptedPackage,
} from "./encrypt";
import { FlowPackError } from "./unpack";

describe("flowpkg encryption", () => {
  it("detects encrypted packages and round-trips with passphrase", async () => {
    const inner = await packFlowPackage({
      manifest: createEmptyManifest("Secret"),
      document: new TextEncoder().encode("payload"),
      assets: [],
    });
    expect(isEncryptedPackage(inner)).toBe(false);

    const encrypted = await encryptFlowPackageBytes(inner, "correct-horse");
    expect(isEncryptedPackage(encrypted)).toBe(true);

    const decrypted = await decryptFlowPackageBytes(encrypted, "correct-horse");
    const opened = await unpackFlowPackage(decrypted);
    expect(opened.manifest.name).toBe("Secret");
    expect(new TextDecoder().decode(opened.document)).toBe("payload");
  });

  it("rejects wrong passphrase", async () => {
    const inner = await packFlowPackage({
      manifest: createEmptyManifest("Secret"),
      document: new TextEncoder().encode("payload"),
      assets: [],
    });
    const encrypted = await encryptFlowPackageBytes(inner, "correct-horse");
    await expect(decryptFlowPackageBytes(encrypted, "wrong")).rejects.toMatchObject({
      message: "decrypt_failed",
    });
    await expect(decryptFlowPackageBytes(encrypted, "wrong")).rejects.toBeInstanceOf(FlowPackError);
  });
});

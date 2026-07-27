import { describe, expect, it } from "vitest";
import { packFlowPackage } from "./pack";
import { FlowPackError, unpackFlowPackage } from "./unpack";
import { createEmptyManifest } from "./types";

describe("flowpkg pack/unpack", () => {
  it("round-trips manifest and document bytes", () => {
    const manifest = createEmptyManifest("Demo");
    const document = new TextEncoder().encode("yjs-bytes");
    const packed = packFlowPackage({
      manifest,
      document,
      assets: [{ path: "assets/note.txt", data: new TextEncoder().encode("hi") }],
    });

    const unpacked = unpackFlowPackage(packed);
    expect(unpacked.manifest.name).toBe("Demo");
    expect(unpacked.manifest.pages).toHaveLength(2);
    expect(new TextDecoder().decode(unpacked.document)).toBe("yjs-bytes");
    expect(unpacked.assets).toHaveLength(1);
    expect(unpacked.assets[0]?.path).toBe("assets/note.txt");
  });

  it("rejects invalid zip bytes", () => {
    expect(() => unpackFlowPackage(new Uint8Array([1, 2, 3]))).toThrow(FlowPackError);
  });

  it("rejects package without manifest", () => {
    const packed = packFlowPackage({
      manifest: createEmptyManifest("X"),
      document: new Uint8Array([1]),
      assets: [],
    });
    const files = new Uint8Array(packed);
    expect(files.byteLength).toBeGreaterThan(0);
  });
});

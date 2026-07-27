type FilePickerAccept = {
  description: string;
  accept: Record<string, string[]>;
};

export type FlowFileHandle = {
  name: string;
  createWritable: () => Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type WindowWithFS = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: FilePickerAccept[];
  }) => Promise<FlowFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: FilePickerAccept[];
  }) => Promise<FlowFileHandle>;
};

const FLOWPKG_TYPE: FilePickerAccept = {
  description: "Flowboard package",
  accept: { "application/zip": [".flowpkg"] },
};

export function supportsFileSystemAccess(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as WindowWithFS;
  return typeof w.showOpenFilePicker === "function" && typeof w.showSaveFilePicker === "function";
}

export async function pickOpenFlowPackage(): Promise<{ bytes: Uint8Array; handle: FlowFileHandle | null; name: string }> {
  const w = window as WindowWithFS;
  if (supportsFileSystemAccess() && w.showOpenFilePicker) {
    const [handle] = await w.showOpenFilePicker({ multiple: false, types: [FLOWPKG_TYPE] });
    const file = await (handle as unknown as { getFile: () => Promise<File> }).getFile();
    const buffer = new Uint8Array(await file.arrayBuffer());
    return { bytes: buffer, handle, name: file.name };
  }

  return pickOpenWithInput();
}

function pickOpenWithInput(): Promise<{ bytes: Uint8Array; handle: null; name: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".flowpkg,application/zip";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("cancelled"));
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      resolve({ bytes, handle: null, name: file.name });
    };
    input.click();
  });
}

export async function pickSaveFlowPackage(suggestedName: string): Promise<FlowFileHandle | null> {
  const w = window as WindowWithFS;
  if (supportsFileSystemAccess() && w.showSaveFilePicker) {
    return w.showSaveFilePicker({
      suggestedName,
      types: [FLOWPKG_TYPE],
    });
  }
  return null;
}

export async function writeToHandle(handle: FlowFileHandle, bytes: Uint8Array): Promise<void> {
  const writable = await handle.createWritable();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await writable.write(buffer);
  await writable.close();
}

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import type { BoardState } from "@/features/workflow/domain/document-data";

function boundsOf(board: BoardState) {
  const boxes = [
    ...board.stickies,
    ...board.shapes,
    ...board.images,
    ...board.frames,
    ...board.strokes.flatMap((stroke) =>
      stroke.points.map((point) => ({ x: point.x, y: point.y, width: 1, height: 1 })),
    ),
  ];
  if (boxes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }
  const minX = Math.min(...boxes.map((box) => box.x)) - 40;
  const minY = Math.min(...boxes.map((box) => box.y)) - 40;
  const maxX = Math.max(...boxes.map((box) => box.x + ("width" in box ? box.width : 1))) + 40;
  const maxY = Math.max(...boxes.map((box) => box.y + ("height" in box ? box.height : 1))) + 40;
  return { minX, minY, maxX, maxY };
}

function paintBoard(board: BoardState, canvas: HTMLCanvasElement) {
  const { minX, minY, maxX, maxY } = boundsOf(board);
  const width = Math.max(320, Math.ceil(maxX - minX));
  const height = Math.max(240, Math.ceil(maxY - minY));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.fillStyle = "#f4f7f6";
  ctx.fillRect(0, 0, width, height);

  for (const frame of board.frames) {
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2;
    ctx.strokeRect(frame.x - minX, frame.y - minY, frame.width, frame.height);
    ctx.fillStyle = "rgba(15,118,110,0.06)";
    ctx.fillRect(frame.x - minX, frame.y - minY, frame.width, frame.height);
    ctx.fillStyle = "#0f766e";
    ctx.font = "14px sans-serif";
    ctx.fillText(frame.title, frame.x - minX + 8, frame.y - minY + 18);
  }

  for (const stroke of board.strokes) {
    if (stroke.points.length < 2) {
      continue;
    }
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x - minX;
      const y = point.y - minY;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  for (const shape of board.shapes) {
    ctx.fillStyle = shape.fill;
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = 2;
    if (shape.kind === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        shape.x - minX + shape.width / 2,
        shape.y - minY + shape.height / 2,
        shape.width / 2,
        shape.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(shape.x - minX, shape.y - minY, shape.width, shape.height);
      ctx.strokeRect(shape.x - minX, shape.y - minY, shape.width, shape.height);
    }
  }

  for (const sticky of board.stickies) {
    ctx.fillStyle = "#f3e2a4";
    ctx.fillRect(sticky.x - minX, sticky.y - minY, sticky.width, sticky.height);
    ctx.fillStyle = "#1f2937";
    ctx.font = "12px sans-serif";
    const lines = sticky.text.split("\n").slice(0, 8);
    lines.forEach((line, index) => {
      ctx.fillText(line.slice(0, 28), sticky.x - minX + 10, sticky.y - minY + 24 + index * 14);
    });
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("export_failed"));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: mime,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildMinimalPdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];
  const offsets: number[] = [];

  const push = (content: string | Uint8Array) => {
    offsets.push(objects.reduce((sum, item) => sum + item.byteLength, 0));
    objects.push(typeof content === "string" ? encoder.encode(content) : content);
  };

  push("%PDF-1.4\n");
  push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>endobj\n`,
  );
  const contentStream = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  push(`4 0 obj<< /Length ${contentStream.length} >>stream\n${contentStream}\nendstream\nendobj\n`);
  const imageHeader = encoder.encode(
    `5 0 obj<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>stream\n`,
  );
  const imageFooter = encoder.encode("\nendstream\nendobj\n");
  const imageObject = new Uint8Array(imageHeader.byteLength + jpeg.byteLength + imageFooter.byteLength);
  imageObject.set(imageHeader, 0);
  imageObject.set(jpeg, imageHeader.byteLength);
  imageObject.set(imageFooter, imageHeader.byteLength + jpeg.byteLength);
  push(imageObject);

  const xrefStart = objects.reduce((sum, item) => sum + item.byteLength, 0);
  let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  push(xref);

  const total = objects.reduce((sum, item) => sum + item.byteLength, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of objects) {
    out.set(part, cursor);
    cursor += part.byteLength;
  }
  return out;
}

export async function exportBoardPng(board: BoardState, filename = "board.png"): Promise<void> {
  const canvas = document.createElement("canvas");
  paintBoard(board, canvas);
  const bytes = await canvasToPngBytes(canvas);
  downloadBytes(bytes, filename, "image/png");
}

export async function exportBoardPdf(board: BoardState, filename = "board.pdf"): Promise<void> {
  const canvas = document.createElement("canvas");
  paintBoard(board, canvas);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = jpegDataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const jpeg = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    jpeg[i] = binary.charCodeAt(i);
  }
  const pdf = buildMinimalPdf(jpeg, canvas.width, canvas.height);
  downloadBytes(pdf, filename, "application/pdf");
}

export async function renderBoardPreviewPng(board: BoardState): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  paintBoard(board, canvas);
  const scale = Math.min(1, 480 / canvas.width, 320 / canvas.height);
  if (scale < 1) {
    const scaled = document.createElement("canvas");
    scaled.width = Math.max(1, Math.floor(canvas.width * scale));
    scaled.height = Math.max(1, Math.floor(canvas.height * scale));
    const ctx = scaled.getContext("2d");
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return canvasToPngBytes(scaled);
    }
  }
  return canvasToPngBytes(canvas);
}

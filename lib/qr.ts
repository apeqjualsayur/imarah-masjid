// Draws a QR code as one SVG path (black squares on a white quiet zone), for
// the screen, the poster and the PDF receipt. Pure JavaScript.

import QRCode from "qrcode";

export type QrShape = { path: string; size: number };

/** The QR as a path in module units. `size` includes a 4-module quiet zone on each side. */
export function qrShape(text: string): QrShape {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const quiet = 4;
  let path = "";
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  return { path, size: modules.size + quiet * 2 };
}

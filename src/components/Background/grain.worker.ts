import { buildPaper } from "./paper";

import type { PaperRequest, PaperResponse } from "./paper";

/**
 * Builds the paper off the main thread (a one-off job: ~50–200 ms of noise, then PNG encoding) and hands back
 * the two images, or their raw pixels where the worker has no `OffscreenCanvas` to encode them.
 */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PaperRequest>) => void) | null;
  postMessage(message: PaperResponse, transfer?: Transferable[]): void;
};

async function encode(pixels: Uint8ClampedArray, size: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(size, size);
  canvas.getContext("2d")!.putImageData(new ImageData(pixels, size, size), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

scope.onmessage = async ({ data }) => {
  const started = performance.now();
  const paper = buildPaper(data);
  if (typeof OffscreenCanvas === "undefined") {
    scope.postMessage({ ...paper, ms: performance.now() - started }, [paper.tile.buffer, paper.mottle.buffer]);
    return;
  }
  const [tile, mottle] = await Promise.all([encode(paper.tile, paper.tileSize), encode(paper.mottle, paper.mottleSize)]);
  scope.postMessage({ tileSize: paper.tileSize, mottleSize: paper.mottleSize, tile, mottle, ms: performance.now() - started });
};

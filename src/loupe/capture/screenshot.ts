import { Dimensions, PixelRatio } from 'react-native';
import { captureRef, captureScreen } from 'react-native-view-shot';

import type { Screenshot } from '../types';

interface Options {
  format?: 'png' | 'jpg';
  quality?: number;
}

/**
 * Capture the current screen to a temp file.
 *
 * LIMITATION: react-native-view-shot cannot capture GL/Skia surfaces, video, native map tiles,
 * WebView (Android), camera preview, or DRM/secure views — they come back black. For those,
 * capture each surface with its own snapshot API and composite. See
 * docs/design/screenshot-feedback-capture.md §B1. Requires view-shot v5+ on Fabric.
 */
export async function captureScreenshot(opts: Options = {}): Promise<Screenshot> {
  const format = opts.format ?? 'jpg';
  const quality = opts.quality ?? 0.85;

  const uri = await captureScreen({ format, quality, result: 'tmpfile' });

  const { width, height } = Dimensions.get('window');
  const pixelRatio = PixelRatio.get();
  return {
    uri,
    width: Math.round(width * pixelRatio),
    height: Math.round(height * pixelRatio),
    pixelRatio,
    format,
  };
}

export { captureRef };

import Constants from 'expo-constants';
import * as Device from 'expo-device';

import type { CaptureContext, LoupeConfig } from '../types';

/**
 * Assemble the context bundle attached to every report. Everything here is release-safe.
 * Network/console/errors are left empty in the scaffold — see the TODOs to wire the ring buffers.
 */
export async function captureContextBundle(config: LoupeConfig): Promise<CaptureContext> {
  return {
    route: config.getCurrentRoute?.() ?? null,
    device: {
      model: Device.modelName ?? null,
      os: Device.osName ?? null,
      osVersion: Device.osVersion ?? null,
    },
    app: {
      version: Constants.expoConfig?.version ?? null,
      build:
        (Constants as unknown as { nativeBuildVersion?: string }).nativeBuildVersion ?? null,
    },
    ota: readOtaMetadata(),
    // TODO(loupe): wire `react-native-network-logger` (or RN's XHRInterceptor) into a ring buffer.
    network: [],
    // TODO(loupe): patch console.* into a ring buffer.
    logs: [],
    // TODO(loupe): ErrorUtils.setGlobalHandler + global.onunhandledrejection.
    errors: [],
    createdAt: new Date().toISOString(),
  };
}

function readOtaMetadata(): CaptureContext['ota'] {
  // TODO(loupe): when @bitrise/code-push-sdk is installed, read codePush.getUpdateMetadata()
  // → { label, deploymentKey }. This ties a report to the exact JS bundle it came from.
  // See docs/design/iterations-and-notifications.md.
  return null;
}

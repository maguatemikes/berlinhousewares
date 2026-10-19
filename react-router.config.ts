import type {Config} from '@react-router/dev/config';
import {hydrogenPreset} from '@shopify/hydrogen/react-router-preset';

/**
 * React Router 7 config for Hydrogen. The Hydrogen preset is kept: it drives the
 * codegen/route types the app relies on (dropping it breaks cart typing). The
 * runtime move off Workers is handled by removing the oxygen *vite* plugin and
 * serving the build with server/index.ts (Node/Express) — not by the preset.
 */
export default {
  presets: [hydrogenPreset()],
} satisfies Config;

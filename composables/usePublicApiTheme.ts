/**
 * Light or dark, for the public API directory.
 *
 * The mechanism is shared with the other tool pages and lives in
 * `useToolTheme`; only the attribute and the storage key are this page's own.
 * Light is the design's home - the palette is black ink on white with a single
 * blue - and dark is its inverse rather than a second design.
 */
import { createToolTheme } from './useToolTheme'

const { BOOT_SCRIPT, useTheme } = createToolTheme('data-pa-theme', 'public-api-theme')

export const PUBLIC_API_THEME_BOOT_SCRIPT = BOOT_SCRIPT
export const usePublicApiTheme = useTheme

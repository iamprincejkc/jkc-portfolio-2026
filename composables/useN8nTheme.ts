/**
 * Light or dark, for the workflow library.
 *
 * The mechanism - an explicit attribute on the html element, resolved from
 * storage or the system preference by an inline script before the first paint
 * - is shared with the other tool pages and lives in `useToolTheme`. Only the
 * attribute and the storage key are this page's own, so that two tools can
 * hold different preferences and neither can read the other's.
 */
import { createToolTheme } from './useToolTheme'
import type { ToolTheme } from './useToolTheme'

export type N8nTheme = ToolTheme

const { BOOT_SCRIPT, useTheme } = createToolTheme('data-n8-theme', 'n8n-theme')

export const THEME_BOOT_SCRIPT = BOOT_SCRIPT
export const useN8nTheme = useTheme

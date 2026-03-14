/**
 * Monitor name convention parser.
 *
 * Convention: [SITE_CODE] TYPE LABEL
 * Examples:
 *   [ALTO] LINK Fibre Orange     → { siteCode: 'ALTO', componentType: 'link', componentName: 'Fibre Orange' }
 *   [LYON] SDWAN Firewall-1      → { siteCode: 'LYON', componentType: 'sdwan', componentName: 'Firewall-1' }
 *   [MARS] ASSET Switch-Core     → { siteCode: 'MARS', componentType: 'asset', componentName: 'Switch-Core' }
 *
 * Types recognized: LINK (critical impact), SDWAN (warning impact), ASSET (warning impact)
 */

export type MonitorComponentType = 'link' | 'sdwan' | 'asset';

export interface ParsedMonitorName {
  siteCode: string;
  componentType: MonitorComponentType;
  componentName: string;
}

const MONITOR_NAME_REGEX = /^\[([\w-]+)\]\s+(LINK|SDWAN|ASSET)\s+(.+)$/i;

/**
 * Parse a monitor name following the [CODE] TYPE LABEL convention.
 * Returns null if the name doesn't match the convention.
 */
export function parseMonitorName(name: string): ParsedMonitorName | null {
  const match = name.match(MONITOR_NAME_REGEX);
  if (!match) return null;

  return {
    siteCode: match[1].toUpperCase(),
    componentType: match[2].toLowerCase() as MonitorComponentType,
    componentName: match[3].trim(),
  };
}

/**
 * Build a monitor name from its components.
 * Example: buildMonitorName('ALTO', 'link', 'Fibre Orange') → '[ALTO] LINK Fibre Orange'
 */
export function buildMonitorName(
  siteCode: string,
  type: MonitorComponentType | string,
  label: string,
): string {
  return `[${siteCode.toUpperCase()}] ${type.toUpperCase()} ${label}`;
}

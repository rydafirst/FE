// Mirrors ../../contracts/design-tokens.ts and docs/design-system.md
export const tokens = {
  color: {
    ink: '#111111', ink2: '#565656', mid: '#A8A8A8',
    line: '#DADADA', line2: '#EDEDED', bg: '#FFFFFF', bg2: '#FAFAFA',
    primary: '#F97316', primaryPressed: '#E4610C', primarySoft: '#FEEEE0', primaryInk: '#FFFFFF',
    success: '#16A34A', info: '#2563EB', warning: '#A16207', danger: '#DC2626',
  },
  /** Text/icons on a dark or saturated surface. Mirrors --on-dark. */
  onDark: '#FFFFFF',
  /** Type scale in px. Mirrors the --text-* custom properties in globals.css. */
  size: { caption: 12.5, small: 14, body: 16, subtitle: 19, heading: 22, title: 26, display: 38 },
  radius: { sm: 4, md: 6, lg: 8, pill: 999 },
} as const;

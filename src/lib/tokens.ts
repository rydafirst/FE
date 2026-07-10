// Mirrors ../../contracts/design-tokens.ts and docs/design-system.md
export const tokens = {
  color: {
    ink: '#111111', ink2: '#565656', mid: '#A8A8A8',
    line: '#DADADA', line2: '#EDEDED', bg: '#FFFFFF', bg2: '#FAFAFA',
    primary: '#F97316', primaryPressed: '#E4610C', primarySoft: '#FEEEE0', primaryInk: '#FFFFFF',
    success: '#16A34A', info: '#2563EB', warning: '#A16207', danger: '#DC2626',
  },
  radius: { sm: 4, md: 6, lg: 8, pill: 999 },
} as const;

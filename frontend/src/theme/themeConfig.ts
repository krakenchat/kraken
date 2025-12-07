import { createTheme, Theme, alpha } from '@mui/material/styles';
import type { ThemeMode, AccentColor, ThemeIntensity } from './constants';

// Extend MUI theme with custom semantic colors
declare module '@mui/material/styles' {
  interface Palette {
    semantic: {
      status: {
        positive: string;  // Green - for speaking, enabled, success states
        negative: string;  // Red - for muted, disabled, error states
      };
      overlay: {
        light: string;   // Subtle backgrounds, hover states
        medium: string;  // Stronger backgrounds
        heavy: string;   // Scrollbars, heavy overlays
      };
    };
  }
  interface PaletteOptions {
    semantic?: {
      status?: {
        positive?: string;
        negative?: string;
      };
      overlay?: {
        light?: string;
        medium?: string;
        heavy?: string;
      };
    };
  }
}

// Helper to blend two hex colors
function blendColors(color1: string, color2: string, weight: number): string {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));
  const r = Math.round(r1 * weight + r2 * (1 - weight));
  const g = Math.round(g1 * weight + g2 * (1 - weight));
  const b = Math.round(b1 * weight + b2 * (1 - weight));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Accent color palettes
const accentPalettes = {
  teal: {
    primary: '#0d9488',
    light: '#14b8a6',
    dark: '#0f766e',
    lighter: '#5eead4',
    subtle: '#2dd4bf',
  },
  purple: {
    primary: '#8b5cf6',
    light: '#a78bfa',
    dark: '#7c3aed',
    lighter: '#c4b5fd',
    subtle: '#a78bfa',
  },
  orange: {
    primary: '#f97316',
    light: '#fb923c',
    dark: '#ea580c',
    lighter: '#fdba74',
    subtle: '#fb923c',
  },
  blue: {
    primary: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    lighter: '#93c5fd',
    subtle: '#60a5fa',
  },
};

// Base colors for dark mode
const darkBase = {
  background: {
    default: '#111318',
    paper: '#1a1d24',
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    disabled: 'rgba(255, 255, 255, 0.5)',
  },
};

// Base colors for light mode
const lightBase = {
  background: {
    default: '#f5f5f5',
    paper: '#ffffff',
  },
  text: {
    primary: '#1a1a1a',
    secondary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
};

export function generateTheme(
  mode: ThemeMode,
  accentColor: AccentColor,
  intensity: ThemeIntensity
): Theme {
  const accent = accentPalettes[accentColor];
  const base = mode === 'dark' ? darkBase : lightBase;
  const isDark = mode === 'dark';
  const isVibrant = intensity === 'vibrant';

  // Semantic colors that adapt to light/dark mode
  // Simplified to just status indicators and overlay levels
  const semanticColors = {
    status: {
      positive: '#22c55e', // Green - for speaking, enabled, success states
      negative: '#ef4444', // Red - for muted, disabled, error states
    },
    overlay: {
      light: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      medium: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      heavy: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    },
  };

  return createTheme({
    palette: {
      mode,
      primary: {
        main: accent.primary,
        light: accent.light,
        dark: accent.dark,
      },
      background: {
        default: isVibrant && isDark
          ? `linear-gradient(180deg, ${alpha(accent.dark, 0.15)} 0%, ${base.background.default} 100%)`
          : base.background.default,
        paper: base.background.paper,
      },
      text: base.text,
      semantic: semanticColors,
    },
    components: {
      // Paper components
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: base.background.paper,
            border: `1px solid ${alpha(accent.primary, isVibrant ? 0.25 : 0.1)}`,
            ...(isVibrant && {
              boxShadow: `0 0 0 1px ${alpha(accent.primary, 0.05)} inset`,
            }),
          },
        },
      },

      // Card components
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: base.background.paper,
            border: `1px solid ${alpha(accent.primary, isVibrant ? 0.3 : 0.08)}`,
            transition: 'box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out, border-color 0.2s ease-in-out',
            ...(isVibrant && {
              boxShadow: `0 2px 12px ${alpha(accent.primary, 0.12)}`,
            }),
            '&:hover': {
              boxShadow: isDark
                ? `0 4px 24px ${alpha(accent.primary, isVibrant ? 0.3 : 0.1)}`
                : `0 4px 20px ${alpha(accent.primary, isVibrant ? 0.2 : 0.08)}`,
              ...(isVibrant && {
                borderColor: alpha(accent.primary, 0.5),
              }),
            },
          },
        },
      },

      // Buttons
      MuiButton: {
        styleOverrides: {
          contained: {
            background: isVibrant
              ? `linear-gradient(135deg, ${accent.primary} 0%, ${accent.light} 100%)`
              : accent.primary,
            boxShadow: 'none',
            '&:hover': {
              background: isVibrant
                ? `linear-gradient(135deg, ${accent.dark} 0%, ${accent.primary} 100%)`
                : accent.dark,
              boxShadow: `0 2px 8px ${alpha(accent.primary, 0.4)}`,
            },
          },
          outlined: {
            borderColor: alpha(accent.primary, 0.5),
            color: accent.light,
            '&:hover': {
              borderColor: accent.primary,
              backgroundColor: alpha(accent.primary, 0.08),
            },
          },
        },
      },

      // List item buttons (sidebar)
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginBottom: 2,
            transition: 'background-color 0.15s ease-in-out',
            '&:hover': {
              backgroundColor: alpha(accent.primary, isVibrant ? 0.12 : 0.08),
            },
            '&.Mui-selected': {
              backgroundColor: alpha(accent.primary, isVibrant ? 0.2 : 0.12),
              borderLeft: `3px solid ${accent.primary}`,
              '&:hover': {
                backgroundColor: alpha(accent.primary, isVibrant ? 0.25 : 0.16),
              },
            },
          },
        },
      },

      // Chips
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(accent.primary, isVibrant ? 0.2 : 0.1),
            color: accent.lighter,
            border: isVibrant ? `1px solid ${alpha(accent.primary, 0.3)}` : 'none',
          },
        },
      },

      // Drawer (sidebar)
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: base.background.paper,
            borderRight: `1px solid ${alpha(accent.primary, isVibrant ? 0.4 : 0.08)}`,
            ...(isVibrant && {
              background: isDark
                ? `linear-gradient(180deg, ${blendColors(accent.dark, base.background.paper, 0.4)} 0%, ${base.background.paper} 100%)`
                : `linear-gradient(180deg, ${blendColors(accent.primary, base.background.paper, 0.25)} 0%, ${base.background.paper} 100%)`,
            }),
          },
        },
      },

      // AppBar
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#151820' : '#ffffff',
            borderBottom: `1px solid ${alpha(accent.primary, isVibrant ? 0.45 : 0.1)}`,
            ...(isVibrant && {
              background: isDark
                ? `linear-gradient(90deg, #151820 0%, ${blendColors(accent.dark, '#151820', 0.45)} 100%)`
                : `linear-gradient(90deg, #ffffff 0%, ${blendColors(accent.primary, '#ffffff', 0.25)} 100%)`,
            }),
          },
        },
      },

      // Links
      MuiLink: {
        styleOverrides: {
          root: {
            color: accent.subtle,
            '&:hover': {
              color: accent.light,
            },
          },
        },
      },

      // Typography for links
      MuiTypography: {
        styleOverrides: {
          root: {
            '&.MuiTypography-colorPrimary': {
              color: accent.subtle,
            },
          },
        },
      },

      // Text fields
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: accent.primary,
            },
          },
          notchedOutline: {
            borderColor: alpha(accent.primary, 0.3),
          },
        },
      },

      // Icon buttons
      MuiIconButton: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: alpha(accent.primary, 0.1),
            },
          },
        },
      },

      // Tabs
      MuiTab: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              color: accent.light,
            },
          },
        },
      },

      // Switch
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: accent.primary,
              '& + .MuiSwitch-track': {
                backgroundColor: accent.primary,
              },
            },
          },
        },
      },

      // Checkbox
      MuiCheckbox: {
        styleOverrides: {
          root: {
            '&.Mui-checked': {
              color: accent.primary,
            },
          },
        },
      },

      // Radio
      MuiRadio: {
        styleOverrides: {
          root: {
            '&.Mui-checked': {
              color: accent.primary,
            },
          },
        },
      },

      // Slider
      MuiSlider: {
        styleOverrides: {
          root: {
            color: accent.primary,
          },
        },
      },

      // Linear Progress
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(accent.primary, 0.2),
          },
          bar: {
            backgroundColor: accent.primary,
          },
        },
      },

      // Circular Progress
      MuiCircularProgress: {
        styleOverrides: {
          root: {
            color: accent.primary,
          },
        },
      },

      // Tooltip
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#2a2d35' : '#333',
          },
        },
      },

      // CssBaseline for body background
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: base.background.default,
            ...(isVibrant && {
              background: isDark
                ? `linear-gradient(180deg, ${blendColors(accent.dark, base.background.default, 0.2)} 0%, ${base.background.default} 500px)`
                : `linear-gradient(180deg, ${blendColors(accent.primary, base.background.default, 0.15)} 0%, ${base.background.default} 500px)`,
              backgroundAttachment: 'fixed',
            }),
          },
        },
      },
    },
  });
}

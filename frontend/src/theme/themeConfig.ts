import { createTheme, Theme, alpha } from '@mui/material/styles';
import type { ThemeMode, AccentColor, ThemeIntensity } from './constants';

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
            border: `1px solid ${alpha(accent.primary, isVibrant ? 0.2 : 0.1)}`,
          },
        },
      },

      // Card components
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: base.background.paper,
            border: `1px solid ${alpha(accent.primary, isVibrant ? 0.2 : 0.08)}`,
            transition: 'box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out',
            '&:hover': {
              boxShadow: isDark
                ? `0 4px 20px ${alpha(accent.primary, isVibrant ? 0.2 : 0.1)}`
                : `0 4px 16px rgba(0, 0, 0, 0.12)`,
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
            backgroundColor: isVibrant
              ? alpha(accent.dark, isDark ? 0.1 : 0.05)
              : base.background.paper,
            borderRight: `1px solid ${alpha(accent.primary, isVibrant ? 0.2 : 0.08)}`,
            ...(isVibrant && isDark && {
              background: `linear-gradient(180deg, ${alpha(accent.dark, 0.15)} 0%, ${base.background.paper} 100%)`,
            }),
          },
        },
      },

      // AppBar
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#151820' : '#ffffff',
            borderBottom: `1px solid ${alpha(accent.primary, isVibrant ? 0.25 : 0.1)}`,
            ...(isVibrant && {
              background: isDark
                ? `linear-gradient(90deg, #151820 0%, ${alpha(accent.dark, 0.2)} 100%)`
                : `linear-gradient(90deg, #ffffff 0%, ${alpha(accent.light, 0.1)} 100%)`,
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
            ...(isVibrant && isDark && {
              background: `linear-gradient(180deg, ${alpha(accent.dark, 0.08)} 0%, ${base.background.default} 300px)`,
              backgroundAttachment: 'fixed',
            }),
          },
        },
      },
    },
  });
}

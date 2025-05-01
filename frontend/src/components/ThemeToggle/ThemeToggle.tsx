import IconButton from "@mui/material/IconButton";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import Tooltip from "@mui/material/Tooltip";
import { useColorScheme } from "@mui/material/styles";

export default function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const getSystemMode = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  if (!mode) return null;
  const effectiveMode = mode === "system" ? getSystemMode() : mode;
  const isDark = effectiveMode === "dark";

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton
        color="inherit"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setMode(isDark ? "light" : "dark")}
        size="large"
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

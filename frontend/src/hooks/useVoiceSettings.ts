import { useState, useCallback } from 'react';
import { getCachedItem, setCachedItem } from '../utils/storage';

export type VoiceInputMode = 'voice_activity' | 'push_to_talk';

export interface VoiceSettings {
  inputMode: VoiceInputMode;
  pushToTalkKey: string;        // KeyboardEvent.code, e.g., 'Space', 'KeyV'
  pushToTalkKeyDisplay: string; // Human-readable display, e.g., 'Space', 'V'
}

const VOICE_SETTINGS_KEY = 'kraken_voice_settings';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  inputMode: 'voice_activity',
  pushToTalkKey: 'Backquote',
  pushToTalkKeyDisplay: '`',
};

/**
 * Helper to get a human-readable key name from a keyboard event
 */
export function getKeyDisplayName(event: KeyboardEvent): string {
  // Handle special keys
  const specialKeys: Record<string, string> = {
    ' ': 'Space',
    'Space': 'Space',
    'ArrowUp': 'Arrow Up',
    'ArrowDown': 'Arrow Down',
    'ArrowLeft': 'Arrow Left',
    'ArrowRight': 'Arrow Right',
    'Backquote': '`',
    'Minus': '-',
    'Equal': '=',
    'BracketLeft': '[',
    'BracketRight': ']',
    'Backslash': '\\',
    'Semicolon': ';',
    'Quote': "'",
    'Comma': ',',
    'Period': '.',
    'Slash': '/',
  };

  // Check for special keys first
  if (specialKeys[event.code]) {
    return specialKeys[event.code];
  }

  // For letter keys (KeyA, KeyB, etc.), extract the letter
  if (event.code.startsWith('Key')) {
    return event.code.slice(3);
  }

  // For digit keys (Digit1, Digit2, etc.), extract the number
  if (event.code.startsWith('Digit')) {
    return event.code.slice(5);
  }

  // For numpad keys
  if (event.code.startsWith('Numpad')) {
    return `Numpad ${event.code.slice(6)}`;
  }

  // For function keys
  if (event.code.startsWith('F') && !isNaN(parseInt(event.code.slice(1)))) {
    return event.code;
  }

  // Default to the key value or code
  return event.key.length === 1 ? event.key.toUpperCase() : event.code;
}

export const useVoiceSettings = () => {
  // Load saved voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    const saved = getCachedItem<VoiceSettings>(VOICE_SETTINGS_KEY);
    return saved ? { ...DEFAULT_VOICE_SETTINGS, ...saved } : DEFAULT_VOICE_SETTINGS;
  });

  // Save voice settings
  const saveVoiceSettings = useCallback((settings: Partial<VoiceSettings>) => {
    const newSettings = { ...voiceSettings, ...settings };
    setVoiceSettings(newSettings);
    setCachedItem(VOICE_SETTINGS_KEY, newSettings);
  }, [voiceSettings]);

  // Set input mode
  const setInputMode = useCallback((mode: VoiceInputMode) => {
    saveVoiceSettings({ inputMode: mode });
  }, [saveVoiceSettings]);

  // Set PTT key from a keyboard event
  const setPushToTalkKey = useCallback((event: KeyboardEvent) => {
    saveVoiceSettings({
      pushToTalkKey: event.code,
      pushToTalkKeyDisplay: getKeyDisplayName(event),
    });
  }, [saveVoiceSettings]);

  // Set PTT key directly (for programmatic use)
  const setPushToTalkKeyDirect = useCallback((key: string, displayName: string) => {
    saveVoiceSettings({
      pushToTalkKey: key,
      pushToTalkKeyDisplay: displayName,
    });
  }, [saveVoiceSettings]);

  return {
    // Current settings
    settings: voiceSettings,

    // Convenience accessors
    inputMode: voiceSettings.inputMode,
    pushToTalkKey: voiceSettings.pushToTalkKey,
    pushToTalkKeyDisplay: voiceSettings.pushToTalkKeyDisplay,
    isPushToTalk: voiceSettings.inputMode === 'push_to_talk',

    // Setters
    setInputMode,
    setPushToTalkKey,
    setPushToTalkKeyDirect,
    saveVoiceSettings,
  };
};

// Export the storage key for use in voiceThunks
export { VOICE_SETTINGS_KEY };

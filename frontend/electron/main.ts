/**
 * Electron Main Process
 *
 * This is the main process for the Kraken Electron application.
 * It handles window creation, auto-updates, and IPC communication.
 */

import { app, BrowserWindow, ipcMain, session, desktopCapturer, Notification } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { initMain } from 'electron-audio-loopback';
import * as path from 'path';

// Initialize audio loopback for cross-platform system audio capture
initMain();

let mainWindow: BrowserWindow | null = null;

// Track active notifications
const activeNotifications = new Map<string, Notification>();

/**
 * Configure auto-updater
 */
function setupAutoUpdater() {
  // Don't check for updates in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Auto-updater disabled in development mode');
    return;
  }

  // Configure auto-updater logging
  autoUpdater.logger = console;

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('Update available:', info);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('Update not available:', info);
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('Error in auto-updater:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err);
    }
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    console.log(`Download progress: ${progressObj.percent}%`);
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('Update downloaded:', info);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  // Check for updates on startup (after 3 seconds to let app initialize)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('Failed to check for updates:', err);
    });
  }, 3000);

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('Failed to check for updates:', err);
    });
  }, 60 * 60 * 1000);
}

/**
 * Setup IPC handlers
 */
function setupIpcHandlers() {
  // Check for updates manually
  ipcMain.on('check-for-updates', () => {
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        console.error('Failed to check for updates:', err);
      });
    }
  });

  // Quit and install update
  ipcMain.on('quit-and-install', () => {
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.quitAndInstall();
    }
  });

  // Get app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Desktop capture handlers for screen sharing
  ipcMain.handle('desktop-capturer:get-sources', async (_event, types: string[]) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: types as ('window' | 'screen')[],
        thumbnailSize: { width: 320, height: 240 },
        fetchWindowIcons: true
      });

      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        display_id: source.display_id,
        appIcon: source.appIcon ? source.appIcon.toDataURL() : undefined
      }));
    } catch (error) {
      console.error('Failed to get desktop sources:', error);
      throw error;
    }
  });

  // Notification handlers
  ipcMain.on('notification:show', (_event, options: {
    title: string;
    body?: string;
    icon?: string;
    tag?: string;
    silent?: boolean;
  }) => {
    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent || false,
      });

      // Store notification by tag for management
      if (options.tag) {
        activeNotifications.set(options.tag, notification);
      }

      // Handle notification click
      notification.on('click', () => {
        // Focus the main window
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();

          // Send click event to renderer with notification ID
          if (options.tag) {
            mainWindow.webContents.send('notification:click', options.tag);
          }
        }
      });

      // Show the notification
      notification.show();

      // Clean up after notification is closed
      notification.on('close', () => {
        if (options.tag) {
          activeNotifications.delete(options.tag);
        }
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  });

  // Clear notifications by tag
  ipcMain.on('notification:clear', (_event, tag: string) => {
    const notification = activeNotifications.get(tag);
    if (notification) {
      notification.close();
      activeNotifications.delete(tag);
    }
  });
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Security: disable node integration
      nodeIntegration: false,
      // Security: enable context isolation
      contextIsolation: true,
      // Enable preload script
      preload: path.join(__dirname, 'preload.cjs'),
    },
    // Enable fullscreen for HTML5 video elements
    fullscreenable: true,
    // Better default window style
    backgroundColor: '#1a1a1a',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    const devUrl = 'http://localhost:5173/';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files directly
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * App lifecycle
 */

// When Electron has finished initialization
app.whenReady().then(() => {
  // Setup media permissions for camera, microphone, screen sharing, and fullscreen
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'display-capture', 'fullscreen'];

    if (allowedPermissions.includes(permission)) {
      console.log(`Granting permission: ${permission}`);
      callback(true);
    } else {
      console.log(`Denying permission: ${permission}`);
      callback(false);
    }
  });

  // Handle screen sharing requests from LiveKit
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log('Screen share requested via setDisplayMediaRequestHandler');

    try {
      // Check if the renderer has pre-selected a sourceId and settings (from React UI)
      const selectedSourceId = await mainWindow?.webContents.executeJavaScript(
        'window.__selectedScreenSourceId'
      );

      const settings = await mainWindow?.webContents.executeJavaScript(
        'window.__screenShareSettings'
      );

      if (selectedSourceId) {
        console.log(`Using pre-selected source ID: ${selectedSourceId}`);
        console.log(`Screen share settings:`, settings);

        // Clear the selected sourceId and settings
        mainWindow?.webContents.executeJavaScript('delete window.__selectedScreenSourceId');
        mainWindow?.webContents.executeJavaScript('delete window.__screenShareSettings');

        // Get all sources to find the selected one
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 240 },
          fetchWindowIcons: true
        });

        const selectedSource = sources.find(s => s.id === selectedSourceId);

        if (selectedSource) {
          console.log(`Found source: ${selectedSource.name}`);

          // Use settings to determine audio configuration
          const enableAudio = settings?.enableAudio !== false; // Default to true if not specified

          // electron-audio-loopback makes 'loopback' work cross-platform
          callback({
            video: selectedSource,
            audio: enableAudio ? 'loopback' : undefined, // Conditionally include system audio
            enableLocalEcho: enableAudio // Keep audio playing locally when enabled
          });
        } else {
          console.error('Selected source not found:', selectedSourceId);
          callback({});
        }
      } else {
        console.error('No source selected by user');
        // No source was pre-selected, this shouldn't happen in normal flow
        callback({});
      }
    } catch (error) {
      console.error('Failed to get screen source:', error);
      callback({});
    }
  });

  createWindow();
  setupAutoUpdater();
  setupIpcHandlers();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the main window if user tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

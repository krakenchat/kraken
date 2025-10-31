/**
 * Electron Main Process
 *
 * This is the main process for the Kraken Electron application.
 * It handles window creation, auto-updates, and IPC communication.
 */

import { app, BrowserWindow, ipcMain, session, protocol } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

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
 * Register custom protocol for better cookie handling
 */
function registerProtocol() {
  // Register custom protocol to handle app:// URLs
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Setup custom protocol handler
 */
function setupProtocolHandler() {
  protocol.handle('app', async (request) => {
    // Remove the app:// prefix and handle the request
    let url = request.url.substr(6); // Remove 'app://'

    // Handle root path
    if (url === '' || url === '/' || url === 'kraken' || url === 'kraken/') {
      url = 'index.html';
    }

    // Remove any query parameters or hash
    url = url.split('?')[0].split('#')[0];

    // Ensure we're not trying to access files outside of dist
    if (url.includes('..')) {
      return new Response('Forbidden', { status: 403 });
    }

    // Construct the file path
    const filePath = path.join(app.getAppPath(), 'dist', url);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // If file doesn't exist, serve index.html (for SPA routing)
      const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
      const indexContent = fs.readFileSync(indexPath);
      return new Response(indexContent, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    try {
      // Read the file
      const fileContent = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);

      // Return with proper MIME type
      return new Response(fileContent, {
        headers: { 'Content-Type': mimeType }
      });
    } catch (error) {
      console.error('Error reading file:', filePath, error);
      return new Response('File not found', { status: 404 });
    }
  });
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
    // Better default window style
    backgroundColor: '#1a1a1a',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  const devUrl = 'http://localhost:5173/';

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use custom protocol for better cookie handling
    mainWindow.loadURL('app://kraken');
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * App lifecycle
 */

// Register custom protocol before app is ready
registerProtocol();

// When Electron has finished initialization
app.whenReady().then(() => {
  // Setup custom protocol handler
  setupProtocolHandler();

  // Setup media permissions for camera, microphone, and screen sharing
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'display-capture'];

    if (allowedPermissions.includes(permission)) {
      console.log(`Granting permission: ${permission}`);
      callback(true);
    } else {
      console.log(`Denying permission: ${permission}`);
      callback(false);
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

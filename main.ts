import { app, BrowserWindow, Menu, ipcMain, dialog, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

// 创建配置存储
const store = new Store();

// 保持对window对象的全局引用，避免JavaScript垃圾回收时窗口被自动关闭
let mainWindow: BrowserWindow | null = null;

// 获取平台特定的图标路径
function getIconPath(): string {
  const iconDir = path.join(__dirname, '../assets');
  
  switch (process.platform) {
    case 'win32':
      return path.join(iconDir, 'icon.ico');
    case 'darwin':
      return path.join(iconDir, 'icon.icns');
    case 'linux':
    default:
      return path.join(iconDir, 'icon.png');
  }
}

// 检查是否为开发模式
function isDev(): boolean {
  return process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
}

// 设置应用安全策略
function setupSecurityPolicy(): void {
  // 设置内容安全策略
  app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      // 阻止新窗口打开，改为在默认浏览器中打开
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });
  });
}

function createWindow(): void {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: getIconPath(),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    transparent: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    autoHideMenuBar: false
  });

  // 加载应用的index.html
  mainWindow.loadFile('index.html');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // 当窗口被关闭时发出
  mainWindow.on('closed', () => {
    // 取消引用window对象
    mainWindow = null;
  });

  // 开发模式下打开开发者工具
  if (isDev()) {
    mainWindow.webContents.openDevTools();
  }

  // 优化窗口性能
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && isDev()) {
      console.log('Window loaded successfully');
    }
  });

  // 处理窗口未响应
  mainWindow.on('unresponsive', () => {
    console.warn('Window became unresponsive');
  });

  mainWindow.on('responsive', () => {
    if (isDev()) {
      console.log('Window became responsive again');
    }
  });
}

// Electron初始化完成，创建窗口
app.whenReady().then(() => {
  // 设置安全策略
  setupSecurityPolicy();
  
  // 创建主窗口
  createWindow();
  
  // 创建应用菜单
  createMenu();

  app.on('activate', () => {
    // 在macOS上，当点击dock图标并且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 设置应用的用户代理
app.setUserTasks([]);

// 防止多实例运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当运行第二个实例时，将焦点放在主窗口上
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，应用和菜单栏会保持活跃状态，直到用户使用Cmd + Q退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC通信处理
ipcMain.handle('get-app-version', (): string => {
  return app.getVersion();
});

ipcMain.handle('get-store-value', (event: Electron.IpcMainInvokeEvent, key: string): any => {
  return store.get(key);
});

ipcMain.handle('set-store-value', (event: Electron.IpcMainInvokeEvent, key: string, value: any): boolean => {
  store.set(key, value);
  return true;
});

ipcMain.handle('show-save-dialog', async (event: any, options: any): Promise<any> => {
  if (!mainWindow) {
    throw new Error('Main window is not available');
  }
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event: any, options: any): Promise<any> => {
  if (!mainWindow) {
    throw new Error('Main window is not available');
  }
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 创建应用菜单
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建请求',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-request');
            }
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-save');
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 ZeAPI',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-about');
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
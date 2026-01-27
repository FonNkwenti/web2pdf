const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// (Not yet configured)
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#ffffff',
        height: 60
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handler for PDF Conversion
ipcMain.handle('convert-to-pdf', async (event, { url, type }) => {
    console.log(`Received request to convert ${url} to ${type}`);
    
    // Notify renderer that we started
    mainWindow.webContents.send('conversion-status', { status: 'loading', message: 'Loading page...' });

    const offscreenWindow = new BrowserWindow({
        show: false,
        width: 1200, // Standard desktop width for better rendering
        height: 800,
        webPreferences: {
            offscreen: true,
            javascript: true,
            contextIsolation: false, // Easier for injection in offscreen
             nodeIntegration: false
        }
    });

    try {
        await offscreenWindow.loadURL(url, { waitUntil: 'networkidle0' });
        
        mainWindow.webContents.send('conversion-status', { status: 'processing', message: 'Generating PDF...' });

        if (type === 'article') {
             mainWindow.webContents.send('conversion-status', { status: 'processing', message: 'Extracting article...' });
             
             // Locate Readability
             const readabilityPath = path.join(__dirname, '../node_modules/@mozilla/readability/Readability.js');
             
             if (fs.existsSync(readabilityPath)) {
                 const readabilityCode = fs.readFileSync(readabilityPath, 'utf8');
                 
                 // Inject Readability and extract content
                 await offscreenWindow.webContents.executeJavaScript(readabilityCode);
                 
                 await offscreenWindow.webContents.executeJavaScript(`
                    try {
                        const article = new Readability(document.cloneNode(true)).parse();
                        if (article) {
                            // Replace content with article
                            document.body.innerHTML = \`
                                <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
                                    <h1 style="font-size: 2.5em; margin-bottom: 0.5em;">\${article.title}</h1>
                                    <div style="color: #666; margin-bottom: 2em;">\${article.byline || ''}</div>
                                    <div class="article-content">\${article.content}</div>
                                </div>
                            \`;
                            // Remove all scripts and styles to prevent conflicts? 
                            // Actually, keeping generic styles is okay, but we want a clean read.
                        } else {
                            console.error('Readability failed to parse article');
                        }
                    } catch (err) {
                        console.error('Extraction error:', err);
                    }
                 `);
             } else {
                 console.error('Readability.js not found at:', readabilityPath);
                 throw new Error('Readability library not found.');
             }
        } 
        
        // Full Page or after Article extraction
        const pdfData = await offscreenWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
                top: 0.5,
                bottom: 0.5,
                left: 0.5,
                right: 0.5
            }
        });
        
        // Ask user where to save
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save PDF',
            defaultPath: path.join(app.getPath('downloads'), 'document.pdf'),
            filters: [{ name: 'PDFs', extensions: ['pdf'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, pdfData);
            mainWindow.webContents.send('conversion-status', { status: 'complete', message: 'PDF saved successfully!' });
             // Open the file or folder?
            shell.showItemInFolder(filePath);
            return { success: true, filePath };
        } else {
             mainWindow.webContents.send('conversion-status', { status: 'cancelled', message: 'Save cancelled.' });
             return { success: false, error: 'Cancelled' };
        }

    } catch (error) {
        console.error('Conversion failed:', error);
        mainWindow.webContents.send('conversion-status', { status: 'error', message: `Error: ${error.message}` });
        return { success: false, error: error.message };
    } finally {
        if (offscreenWindow) {
            // Close the window
           offscreenWindow.destroy();
        }
    }
});

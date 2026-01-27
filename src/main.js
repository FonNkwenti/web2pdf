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
// IPC Handler for PDF Conversion
ipcMain.handle('convert-to-pdf', async (event, { url, type }) => {
    console.log(`Received request to convert ${url} to ${type}`);
    
    // Notify renderer that we started
    mainWindow.webContents.send('conversion-status', { status: 'loading', message: 'Loading page...' });

    const offscreenWindow = new BrowserWindow({
        show: false,
        width: 1600, // Wider for better layout capture
        height: 1200,
        webPreferences: {
            offscreen: true,
            javascript: true,
            contextIsolation: false, // Easier for injection in offscreen
             nodeIntegration: false
        }
    });

    try {
        await offscreenWindow.loadURL(url, { waitUntil: 'networkidle0' });
        
        // Get the title for naming
        let pageTitle = await offscreenWindow.getTitle();
        // Sanitize title
        pageTitle = pageTitle.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 50);
        const defaultFilename = `${pageTitle || 'document'}.pdf`;

        // Trigger lazy loading by scrolling to bottom
        mainWindow.webContents.send('conversion-status', { status: 'processing', message: 'Loading images...' });
        
        await offscreenWindow.webContents.executeJavaScript(`
            new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 200;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 50); // Fast scroll
            });
        `);
        
        // Brief wait for any final network requests
        await new Promise(r => setTimeout(r, 1000));

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
                        // Attempt to fix lazy loaded images before parsing
                        const images = document.querySelectorAll('img');
                        images.forEach(img => {
                            if (img.dataset.src) img.src = img.dataset.src;
                            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
                        });

                        const article = new Readability(document.cloneNode(true)).parse();
                        if (article) {
                            // Replace content with article
                            // Added better styling for PDF: larger text, full width, image handling
                            document.body.innerHTML = \`
                                <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                                    .article-container { 
                                        width: 100%; 
                                        padding: 20px; 
                                        box-sizing: border-box; 
                                        font-size: 16px; 
                                        line-height: 1.6; 
                                        color: #333;
                                    }
                                    h1 { font-size: 28px; margin-bottom: 10px; color: #111; }
                                    .byline { color: #666; font-size: 14px; margin-bottom: 30px; font-style: italic; }
                                    .article-content { font-size: 18px; }
                                    img { max-width: 100%; height: auto; margin: 20px 0; display: block; border-radius: 4px; }
                                    figure { margin: 20px 0; max-width: 100%; }
                                    figcaption { font-size: 0.9em; color: #666; margin-top: 5px; font-style: italic; }
                                    p { margin-bottom: 1.5em; }
                                    a { color: #0066cc; text-decoration: none; }
                                    pre, code { background: #f5f5f5; padding: 5px; border-radius: 4px; font-family: monospace; overflow-x: auto; }
                                </style>
                                <div class="article-container">
                                    <h1>\${article.title}</h1>
                                    <div class="byline">\${article.byline || 'Unknown Author'}</div>
                                    <div class="article-content">\${article.content}</div>
                                </div>
                            \`;
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
            printBackground: true, // Crucial for images and colors
            landscape: false,
            pageSize: 'A4',
            margins: {
                top: 0.4, // Smaller margins
                bottom: 0.4,
                left: 0.4,
                right: 0.4
            }
        });
        
        // Ask user where to save
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save PDF',
            defaultPath: path.join(app.getPath('downloads'), defaultFilename),
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

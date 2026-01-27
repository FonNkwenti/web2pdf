# Web to PDF Converter

A premium Electron desktop application to convert web pages into clean, readable PDF documents.

## Features

- **Full Page Conversion**: Capture the entire webpage exactly as it looks.
- **Article Mode**: Extract only the main content (text and images) using Mozilla's Readability engine (similar to Reader View).
- **Premium UI**: Modern, dark-mode interface with glassmorphism effects.
- **PDF Options**: High-quality rendering with standard A4 margins.

## Installation

1.  **Prerequisites**: Ensure you have Node.js installed.
2.  **Clone/Download** the repository.
3.  **Install dependencies**:
    ```bash
    npm install
    ```
4.  **Run the application**:
    ```bash
    npm start
    ```

## Usage

1.  **Enter URL**: Paste the web page URL you want to convert.
2.  **Select Mode**:
    -   *Full Page*: For capturing the layout and design.
    -   *Article Only*: For reading without ads or clutter.
3.  **Convert**: Click the button and wait for the "Save" dialog.
4.  **Save**: Choose your destination and filename.

## Technology Stack

-   **Electron**: App framework.
-   **Mozilla Readability**: content extraction.
-   **Vanilla JS/CSS**: Lightweight, high-performance UI.

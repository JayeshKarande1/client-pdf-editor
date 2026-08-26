import asyncio
from playwright.async_api import async_playwright

files = [
    "./js/state.js",
    "./js/services/pdfRenderService.js",
    "./js/services/pdfLibService.js",
    "./js/services/imageService.js",
    "./js/editor/historyManager.js",
    "./js/editor/signatureModal.js",
    "./js/editor/canvasManager.js",
    "./js/editor/toolbar.js",
    "./js/editor/pageManager.js",
    "./js/tools/mergeTool.js",
    "./js/tools/splitTool.js",
    "./js/tools/organizeTool.js",
    "./js/tools/imageConvertTool.js",
    "./js/tools/securityTool.js",
    "./js/tools/watermarkTool.js",
    "./js/app.js",
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("http://localhost:3000/")

        for f in files:
            try:
                await page.evaluate(f'import("{f}")')
                print(f"[OK] {f}")
            except Exception as e:
                print(f"[FAIL] {f}: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

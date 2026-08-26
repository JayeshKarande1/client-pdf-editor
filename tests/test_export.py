import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("http://localhost:3000/")
        await page.locator("#btnHomeLoadSample").click()
        await page.wait_for_selector(".pdf-page-wrapper", timeout=10000)
        await page.wait_for_timeout(1000)

        # Click Edit Existing Text
        await page.locator('.editor-tool-btn[data-tool="edit-text"]').click()
        await page.wait_for_timeout(500)

        # Click first text block
        await page.locator(".existing-text-block").first.click()
        await page.wait_for_timeout(500)

        # Type replacement text
        await page.keyboard.press("Control+A")
        await page.keyboard.type("MODIFIED HEADING BY PDFZEN")
        await page.wait_for_timeout(500)

        # Take screenshot of modified text in place
        modified_screenshot = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\modified_heading_test.png"
        await page.screenshot(path=modified_screenshot)
        print(f"Modified screenshot saved to: {modified_screenshot}")

        # Test Save & Download
        async with page.expect_download() as download_info:
            await page.locator("#btnSaveEditedPdf").click()
        
        download = await download_info.value
        download_path = r"D:\Work\AI-Projects\client-pdf-editor\exported_test_result.pdf"
        await download.save_as(download_path)
        print(f"Successfully downloaded edited PDF ({os.path.getsize(download_path)} bytes) to: {download_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

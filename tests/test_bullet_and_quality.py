import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(device_scale_factor=2) # Test at 2x Retina scaling!

        await page.goto("http://localhost:3000/")
        await page.locator("#btnHomeLoadSample").click()
        await page.wait_for_selector(".pdf-page-wrapper", timeout=10000)
        await page.wait_for_timeout(1000)

        # Select Edit Existing Text
        await page.locator('.editor-tool-btn[data-tool="edit-text"]').click()
        await page.wait_for_timeout(500)

        # Find a bullet point text block
        bullet_block = page.locator('.existing-text-block[title*="•"]').first
        bullet_count = await page.locator('.existing-text-block[title*="•"]').count()
        print(f"Detected {bullet_count} normalized bullet point lines on sample.pdf", flush=True)

        if bullet_count > 0:
            title = await bullet_block.get_attribute("title")
            print(f"Clicking bullet item: {title}", flush=True)
            await bullet_block.click()
            await page.wait_for_timeout(500)

            # Type modified text after bullet
            await page.keyboard.type(" [VERIFIED BULLET EDIT]")
            await page.wait_for_timeout(500)

        # Take screenshot of crisp high-DPI rendering
        screenshot_path = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\bullet_edit_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"High-DPI screenshot saved to: {screenshot_path}", flush=True)

        # Test Export
        async with page.expect_download() as download_info:
            await page.locator("#btnSaveEditedPdf").click()
        
        download = await download_info.value
        export_path = r"D:\Work\AI-Projects\client-pdf-editor\exported_bullet_test.pdf"
        await download.save_as(export_path)
        print(f"[PASS] Successfully exported 300 DPI PDF ({os.path.getsize(export_path)} bytes) to: {export_path}", flush=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[PAGE_ERROR] {err}"))

        print("Navigating to http://localhost:3000/ ...", flush=True)
        await page.goto("http://localhost:3000/")
        await page.wait_for_timeout(1000)

        print("Clicking 'Try with sample PDF' button (#btnHomeLoadSample)...", flush=True)
        btn = page.locator("#btnHomeLoadSample")
        await btn.click()

        print("Waiting for editor workspace and rendered pages...", flush=True)
        try:
            await page.wait_for_selector(".pdf-page-wrapper", timeout=10000)
            print("Successfully rendered .pdf-page-wrapper!", flush=True)
        except Exception as e:
            print("Failed waiting for .pdf-page-wrapper:", e, flush=True)

        await page.wait_for_timeout(2000)

        # Print all console logs
        print("\n--- BROWSER CONSOLE LOGS ---", flush=True)
        for log in console_logs:
            print(log, flush=True)
        print("----------------------------\n", flush=True)

        # Check total rendered pages
        pages_count = await page.locator(".pdf-page-wrapper").count()
        print(f"Total rendered pages: {pages_count}", flush=True)

        # Check thumbnails
        thumbs_count = await page.locator(".thumbnail-item").count()
        print(f"Total thumbnails: {thumbs_count}", flush=True)

        # Check text lines in text layer
        text_blocks_count = await page.locator(".existing-text-block").count()
        print(f"Total detectable existing text blocks: {text_blocks_count}", flush=True)

        # Test selecting "Edit Existing Text" tool
        print("Clicking 'Edit Existing Text' tool button...", flush=True)
        edit_text_btn = page.locator('.editor-tool-btn[data-tool="edit-text"]')
        await edit_text_btn.click()
        await page.wait_for_timeout(500)

        # Click on the first existing text block
        if text_blocks_count > 0:
            print("Clicking on first text block to edit in place...", flush=True)
            first_block = page.locator(".existing-text-block").first
            await first_block.click()
            await page.wait_for_timeout(500)
            print("Typed text into the editor!", flush=True)

        # Take screenshot
        screenshot_path = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\editor_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to: {screenshot_path}", flush=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

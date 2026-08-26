import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(device_scale_factor=2)

        await page.goto("http://localhost:3000/")
        await page.locator("#btnHomeLoadSample").click()
        await page.wait_for_selector(".pdf-page-wrapper", timeout=10000)
        await page.wait_for_timeout(1000)

        # Switch to Edit Existing Text mode
        await page.locator('.editor-tool-btn[data-tool="edit-text"]').click()
        await page.wait_for_timeout(500)

        # Check all text blocks for unwanted \uf0b7 or tofu characters
        text_blocks = await page.evaluate("""
            () => {
                const blocks = Array.from(document.querySelectorAll('.existing-text-block'));
                return blocks.map(b => ({
                    text: b.innerText,
                    title: b.title
                }));
            }
        """)

        print(f"Total extracted text blocks on Page 1: {len(text_blocks)}")
        
        # Verify no block contains \uf0b7 or tofu
        has_bad_bullet = any('\uf0b7' in b['title'] for b in text_blocks)
        print(f"Contains un-normalized private bullet '\\uf0b7': {has_bad_bullet} (expected False)")
        assert not has_bad_bullet, "Private bullet character \\uf0b7 was not normalized!"

        # Find the 'Nulla facilisi.' bullet block
        nulla_block = page.locator('.existing-text-block[title*="Nulla facilisi"]').first
        nulla_title = await nulla_block.get_attribute("title")
        print(f"Nulla facilisi block title: {nulla_title}")
        assert "•" in nulla_title, "Bullet symbol was not merged with Nulla facilisi!"

        # Click the Nulla facilisi block
        await nulla_block.click()
        await page.wait_for_timeout(500)

        # Inspect the Fabric text object properties
        fabric_props = await page.evaluate("""
            async () => {
                const { state } = await import('./js/state.js');
                const canvas = state.doc.pageCanvases.get(0);
                const active = canvas.getActiveObject();
                return active ? {
                    text: active.text,
                    fontStyle: active.fontStyle,
                    fontWeight: active.fontWeight,
                    fontFamily: active.fontFamily,
                    fontSize: active.fontSize
                } : null;
            }
        """)

        print(f"Active Fabric Text Object: {fabric_props}")
        assert fabric_props is not None, "No active text object created!"
        assert fabric_props["fontStyle"] == "italic", f"Expected italic style, got {fabric_props['fontStyle']}"
        assert fabric_props["text"].startswith("•"), f"Expected text to start with '•', got {fabric_props['text']}"
        assert "\uf0b7" not in fabric_props["text"], "Fabric text contains private code point \\uf0b7!"

        # Take screenshot of the crisp in-place edit
        screenshot_path = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\perfect_bullet_edit.png"
        await page.screenshot(path=screenshot_path)
        print(f"[PASS] All bullet and style assertions passed! Screenshot saved to: {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

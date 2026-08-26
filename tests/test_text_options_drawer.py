import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(device_scale_factor=2)

        print("1. Loading PDFZen editor at http://localhost:3000/ ...", flush=True)
        await page.goto("http://localhost:3000/")
        await page.locator("#btnHomeLoadSample").click()
        await page.wait_for_selector(".pdf-page-wrapper", timeout=10000)
        await page.wait_for_timeout(1000)

        # 2. Open Text Options Drawer
        print("2. Opening Text Options Drawer via #btnToggleTextOptions...", flush=True)
        await page.locator("#btnToggleTextOptions").click()
        await page.wait_for_timeout(300)
        
        is_visible = await page.locator("#textOptionsDrawer").is_visible()
        print(f"   Text Options Drawer visible: {is_visible} (expected True)", flush=True)
        assert is_visible, "Text options drawer failed to open!"

        # 3. Add text with Text Tool
        print("3. Adding Text on Canvas...", flush=True)
        await page.locator('.editor-tool-btn[data-tool="text"]').click()
        await page.wait_for_timeout(300)

        box = await page.locator("#page-wrapper-0").bounding_box()
        await page.mouse.click(box['x'] + 200, box['y'] + 180)
        await page.wait_for_timeout(500)
        await page.keyboard.type("Custom Typography Test")
        await page.wait_for_timeout(300)

        # 4. Apply Heading 1 Preset
        print("4. Applying Heading 1 Preset (24px Bold)...", flush=True)
        await page.locator("#optPresetSelect").select_option("h1")
        await page.wait_for_timeout(300)

        # 5. Apply Blue Text Color Swatch
        print("5. Clicking Blue Color Swatch...", flush=True)
        await page.locator('.opt-color-swatch[data-color="#2563eb"]').click()
        await page.wait_for_timeout(300)

        # 6. Apply Underline & Center Align
        print("6. Applying Underline & Center Align...", flush=True)
        await page.locator("#optUnderlineBtn").click()
        await page.wait_for_timeout(200)
        await page.locator('.opt-align-btn[data-align="center"]').click()
        await page.wait_for_timeout(300)

        # 7. Apply Bullet List
        print("7. Applying Bullet list...", flush=True)
        await page.locator("#optListBullet").click()
        await page.wait_for_timeout(300)

        # 8. Check Fabric Object properties
        props = await page.evaluate("""
            async () => {
                const { state } = await import('./js/state.js');
                const canvas = state.doc.pageCanvases.get(0);
                const active = canvas.getActiveObject();
                return active ? {
                    text: active.text,
                    fontSize: active.fontSize,
                    fontWeight: active.fontWeight,
                    underline: active.underline,
                    fill: active.fill,
                    textAlign: active.textAlign
                } : null;
            }
        """)

        print(f"   Fabric Text Object Updated Properties: {props}", flush=True)
        assert props is not None, "No active text object found!"
        assert props["fontSize"] == 24, f"Expected 24px font size, got {props['fontSize']}"
        assert props["fontWeight"] == "bold", f"Expected bold, got {props['fontWeight']}"
        assert props["fill"] == "#2563eb", f"Expected #2563eb, got {props['fill']}"
        assert props["textAlign"] == "center", f"Expected center alignment, got {props['textAlign']}"
        assert props["text"].startswith("•"), f"Expected text to start with bullet, got {props['text']}"

        # 9. Take Screenshot
        screenshot_path = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\text_options_drawer_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"[PASS] Text Options Drawer fully verified! Screenshot saved to: {screenshot_path}", flush=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

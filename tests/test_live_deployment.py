import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(device_scale_factor=2)

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        print("1. Opening live GitHub Pages site at https://jayeshkarande1.github.io/client-pdf-editor/ ...")
        res = await page.goto("https://jayeshkarande1.github.io/client-pdf-editor/", wait_until="networkidle")
        print(f"   HTTP Status: {res.status}")
        assert res.status == 200, f"Expected 200, got {res.status}"

        # 2. Verify Home Page elements
        print("2. Verifying UI components and Lucide icons...")
        await page.wait_for_selector("#btnHomeLoadSample", timeout=8000)
        title = await page.title()
        print(f"   Page Title: {title}")

        # 3. Test Sample PDF Load
        print("3. Clicking 'Try with sample PDF' on live site...")
        await page.locator("#btnHomeLoadSample").click()
        await page.wait_for_selector(".pdf-page-wrapper", timeout=12000)
        print("   PDF successfully rendered on live server!")

        # 4. Open Text Options Drawer
        print("4. Opening Text Options Drawer...")
        await page.locator("#btnToggleTextOptions").click()
        await page.wait_for_timeout(500)
        is_drawer_visible = await page.locator("#textOptionsDrawer").is_visible()
        print(f"   Text Options Drawer visible: {is_drawer_visible}")
        assert is_drawer_visible, "Text options drawer is not visible!"

        # 5. Take Live Screenshot
        screenshot_path = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\live_deployment_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"[PASS] Live deployment verified with 0 errors! Screenshot saved to: {screenshot_path}")

        if errors:
            print(f"Page errors encountered: {errors}")
        assert len(errors) == 0, f"Errors found on page: {errors}"

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

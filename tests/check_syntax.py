import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        page.on("pageerror", lambda err: print(f"PAGE_ERROR: {err}\nStack: {err.stack}"))
        page.on("console", lambda msg: print(f"CONSOLE: [{msg.type}] {msg.text}"))

        await page.goto("http://localhost:3000/")
        await page.wait_for_timeout(2000)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 900})

        console_logs = []
        page.on("console", lambda msg: print(f"  [BROWSER] {msg.text}", flush=True))
        page.on("pageerror", lambda err: print(f"  [BROWSER ERROR] {err}", flush=True))

        print("1. Loading application at http://localhost:3000/ ...", flush=True)
        await page.goto("http://localhost:3000/")
        await page.wait_for_timeout(500)

        # Load sample PDF
        print("2. Loading sample PDF...", flush=True)
        await page.locator("#btnHomeLoadSample").click()
        await page.wait_for_selector(".pdf-page-wrapper", timeout=10000)
        await page.wait_for_timeout(1000)

        # Helper to get fabric object count on page 0
        async def get_object_count():
            return await page.evaluate("""
                () => {
                    const canvas = window.__pdfZenState ? window.__pdfZenState.doc.pageCanvases.get(0) : null;
                    if (!canvas) {
                        const c = document.querySelector('#fabric-canvas-0');
                        return c && c.fabric ? c.fabric.getObjects().length : 0;
                    }
                    return canvas.getObjects().length;
                }
            """)

        # Expose state to window for testing
        await page.evaluate("""
            import('./js/state.js').then(m => {
                window.__pdfZenState = m.state;
            });
        """)
        await page.wait_for_timeout(500)

        initial_count = await get_object_count()
        print(f"   Initial object count on Page 1: {initial_count}", flush=True)

        # TEST 1: Add Text Tool
        print("\n--- TEST 1: Add Text Tool & Undo / Redo ---", flush=True)
        await page.locator('.editor-tool-btn[data-tool="text"]').click()
        await page.wait_for_timeout(300)

        # Click on canvas to insert text
        canvas_wrapper = page.locator("#page-wrapper-0 .canvas-container").first
        box = await canvas_wrapper.bounding_box()
        await page.mouse.click(box['x'] + 150, box['y'] + 150)
        await page.wait_for_timeout(500)

        count_after_add = await get_object_count()
        print(f"   Objects after adding text: {count_after_add} (expected {initial_count + 1})", flush=True)
        assert count_after_add == initial_count + 1, f"Expected {initial_count + 1} objects, got {count_after_add}"

        # Test Undo
        print("   Clicking Undo button (#btnUndo)...", flush=True)
        await page.locator("#btnUndo").click()
        await page.wait_for_timeout(500)

        count_after_undo = await get_object_count()
        print(f"   Objects after Undo: {count_after_undo} (expected {initial_count})", flush=True)
        assert count_after_undo == initial_count, f"Undo failed! Expected {initial_count}, got {count_after_undo}"

        # Test Redo
        print("   Clicking Redo button (#btnRedo)...", flush=True)
        await page.locator("#btnRedo").click()
        await page.wait_for_timeout(500)

        count_after_redo = await get_object_count()
        print(f"   Objects after Redo: {count_after_redo} (expected {initial_count + 1})", flush=True)
        assert count_after_redo == initial_count + 1, f"Redo failed! Expected {initial_count + 1}, got {count_after_redo}"

        # TEST 2: Object Deletion & Undo Deletion
        print("\n--- TEST 2: Delete Object & Undo Deletion ---", flush=True)
        # Select the object and click delete
        await page.evaluate("""
            () => {
                const canvas = window.__pdfZenState.doc.pageCanvases.get(0);
                const objs = canvas.getObjects();
                if (objs.length > 0) {
                    canvas.setActiveObject(objs[objs.length - 1]);
                    canvas.renderAll();
                }
            }
        """)
        await page.wait_for_timeout(300)
        print("   Clicking Delete Object button (#btnDeleteObject)...", flush=True)
        await page.locator("#btnDeleteObject").click(force=True)
        await page.wait_for_timeout(500)

        count_after_delete = await get_object_count()
        print(f"   Objects after delete: {count_after_delete} (expected {initial_count})", flush=True)
        assert count_after_delete == initial_count, f"Delete failed! Expected {initial_count}, got {count_after_delete}"

        # Undo the deletion
        print("   Clicking Undo to restore deleted object...", flush=True)
        await page.locator("#btnUndo").click()
        await page.wait_for_timeout(500)

        count_restored = await get_object_count()
        print(f"   Objects after undo delete: {count_restored} (expected {initial_count + 1})", flush=True)
        assert count_restored == initial_count + 1, f"Undo delete failed! Expected {initial_count + 1}, got {count_restored}"

        # TEST 3: Shape Tools (Rectangle & Whiteout)
        print("\n--- TEST 3: Shape Creation (Rectangle) & Undo ---", flush=True)
        await page.locator('.editor-tool-btn[data-tool="rectangle"]').click()
        await page.wait_for_timeout(300)

        # Drag rectangle on canvas
        await page.mouse.move(box['x'] + 200, box['y'] + 200)
        await page.mouse.down()
        await page.mouse.move(box['x'] + 350, box['y'] + 280)
        await page.mouse.up()
        await page.wait_for_timeout(500)

        count_after_rect = await get_object_count()
        print(f"   Objects after drawing rectangle: {count_after_rect} (expected {count_restored + 1})", flush=True)
        assert count_after_rect == count_restored + 1, "Rectangle creation failed"

        # Undo rectangle
        print("   Clicking Undo for rectangle...", flush=True)
        await page.locator("#btnUndo").click()
        await page.wait_for_timeout(500)
        count_undo_rect = await get_object_count()
        print(f"   Objects after undo rectangle: {count_undo_rect} (expected {count_restored})", flush=True)
        assert count_undo_rect == count_restored, "Undo rectangle failed"

        # TEST 4: In-Place "Edit Existing Text" & Undo
        print("\n--- TEST 4: In-Place 'Edit Existing Text' & Undo ---", flush=True)
        await page.locator('.editor-tool-btn[data-tool="edit-text"]').click()
        await page.wait_for_timeout(300)

        first_text_block = page.locator(".existing-text-block").first
        await first_text_block.click()
        await page.wait_for_timeout(500)

        count_after_edit_text = await get_object_count()
        print(f"   Objects after edit-text click (mask + text): {count_after_edit_text} (expected {count_undo_rect + 2})", flush=True)
        assert count_after_edit_text == count_undo_rect + 2, "In-place edit text creation failed"

        # Undo edit-text replacement
        print("   Clicking Undo to revert in-place text replacement...", flush=True)
        await page.locator("#btnUndo").click()
        await page.wait_for_timeout(500)
        count_undo_edit_text = await get_object_count()
        print(f"   Objects after undo edit-text: {count_undo_edit_text} (expected {count_undo_rect})", flush=True)
        assert count_undo_edit_text == count_undo_rect, "Undo in-place edit failed"

        # Take screenshot of final verified state
        screenshot_path = r"C:\Users\Karande\.gemini\antigravity\brain\bfd7d637-22e7-43a9-9f7a-049c4c537e05\crud_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"\n[PASS] ALL CRUD & UNDO/REDO TESTS PASSED! Screenshot saved to: {screenshot_path}", flush=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

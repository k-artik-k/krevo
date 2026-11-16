"""Local browser test: seeds demo data through the admin API, takes screenshots, checks keyboard + history behaviour.
Usage: ADMIN_PASSWORD=... python3 scripts/browser-test.py [base_url] [out_dir]"""
import os, sys, zlib, struct, json, time
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/shots"
PW = os.environ["ADMIN_PASSWORD"]
if not any(h in B for h in ("localhost", "127.0.0.1")):
    sys.exit("Refusing to run: this script DELETES all projects and media, so it only targets localhost.")
os.makedirs(OUT, exist_ok=True)


def png(w, h, fn):
    def ch(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    rows = b"".join(b"\x00" + b"".join(bytes(fn(x, y, w, h)) for x in range(w)) for y in range(h))
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(rows)) + ch(b"IEND", b"")


def grad(a, b):
    return lambda x, y, w, h: [int(a[i] + (b[i] - a[i]) * (x / w * .5 + y / h * .5)) for i in range(3)]


errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    api = ctx.request
    r = api.post(B + "/api/admin/login", data={"password": PW}, headers={"Origin": B})
    assert r.ok, r.text()
    H = {"Origin": B, "x-csrf-token": r.json()["csrf"]}
    for pr in api.get(B + "/api/admin/projects").json()["projects"]:
        api.delete(f"{B}/api/admin/projects/{pr['id']}", headers=H)
    for m in api.get(B + "/api/admin/media").json()["media"]:
        api.delete(f"{B}/api/admin/media/{m['key']}?force=1", headers=H)
    keys = []
    for a, b in [((255, 190, 120), (120, 90, 200)), ((90, 200, 160), (30, 90, 160)), ((250, 120, 120), (255, 220, 120))]:
        up = api.post(B + "/api/admin/media", headers={"Origin": B, "x-csrf-token": H["x-csrf-token"]},
                      multipart={"file": {"name": "a.png", "mimeType": "image/png", "buffer": png(320, 200, grad(a, b))}})
        keys.append(up.json()["key"])
    seed = [
        ("Line Follower Robot", 2016, "Hardware", "My first robot that followed a black line around the living room floor.", ["Arduino", "C++"], keys[0], keys[1:], "published"),
        ("Pocket Weather Toy", 2019, "Web", "A tiny page that draws the sky in your browser.", ["HTML", "CSS", "JavaScript"], None, [], "published"),
        ("Malware Image Classifier", 2026, "AI", "Turns binaries into images and classifies them with deep learning.", ["Python", "PyTorch"], keys[1], [], "published"),
        ("Morse Code Player", 2025, "Audio", "Type text, hear Morse code, and decode it back again.", ["Web Audio"], None, [], "published"),
        ("A Project With A Very Long Title That Should Be Cut Off Nicely", 2021, "Experiment", "A very long description that keeps going and going to make sure card heights stay uniform across a whole row of cards.", ["Rust"], None, [], "published"),
        ("Pvt Diary", 2024, "Full stack", "A private diary app with encrypted entries.", ["React", "Node"], keys[2], [], "published"),
        ("Hidden Draft", 2026, "Secret", "Nobody should see this.", [], None, [], "draft"),
    ]
    for t, y, c, d, tech, cover, gal, st in seed:
        api.post(B + "/api/admin/projects", headers=H, data={"title": t, "year": y, "category": c, "shortDescription": d, "fullDescription": d + "\n\nSecond paragraph with more detail about how it was built and what went wrong along the way.", "technologies": tech, "coverKey": cover, "gallery": gal, "status": st,
                 "githubUrl": "https://github.com/example/repo", "liveUrl": "https://example.com"})
    api.put(B + "/api/admin/settings", headers=H, data={"displayName": "Kartikeya's Archive", "browserTitle": "Kartikeya's Archive", "profileName": "Kartikeya", "profileBio": "Student, maker, tinkerer.", "aboutText": "I build things.\n\nThis is the about text.",
            "githubUrl": "https://github.com/example", "portfolioUrl": "https://example.com", "contactEmail": "hello@example.com", "intensity": 2, "clouds": True, "birds": True, "timeSky": True, "easterEggs": True})

    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))

    for hour, name in [(12, "noon"), (6, "sunrise"), (18.75, "sunset"), (22, "night")]:
        page.goto(f"{B}/?hour={hour}")
        page.wait_for_selector(".card")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/{name}.png")
    print("title:", page.title())
    print("cards:", page.locator(".card").count(), "(7 seeded, 1 draft => expect 6)")
    heights = page.evaluate("[...document.querySelectorAll('.card')].map(c=>Math.round(c.getBoundingClientRect().height))")
    cols = page.evaluate("getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length")
    print("card heights:", heights, "columns:", cols)

    # keyboard + history + scroll restoration
    page.set_viewport_size({"width": 1280, "height": 600})
    page.goto(f"{B}/?hour=12"); page.wait_for_selector(".card")
    page.evaluate("window.scrollTo(0, 220)"); page.wait_for_timeout(200)
    for _ in range(12):
        page.keyboard.press("Tab")
        if page.evaluate("document.activeElement.classList.contains('card')"): break
    focused = page.evaluate("document.activeElement.getAttribute('href')")
    page.evaluate("window.scrollTo(0, 220)"); print("scrollY before open:", page.evaluate("Math.round(scrollY)"))
    page.keyboard.press("Enter"); page.wait_for_selector("[role=dialog]")
    print("opened via Enter:", focused, "->", page.evaluate("location.pathname"), "| focus inside dialog:", page.evaluate("!!document.activeElement.closest('[role=dialog]')"))
    page.wait_for_timeout(500); page.screenshot(path=f"{OUT}/dialog.png")
    page.keyboard.press("Tab"); page.keyboard.press("Shift+Tab")
    page.keyboard.press("Escape"); page.wait_for_timeout(400)
    print("after Escape: path", page.evaluate("location.pathname"), "| scrollY", page.evaluate("Math.round(scrollY)"), "| focus back on card:", page.evaluate("document.activeElement.getAttribute('href')"))
    page.click(".card >> nth=1", force=True); page.wait_for_selector("[role=dialog]"); page.go_back(); page.wait_for_timeout(300)
    print("browser Back closes dialog:", page.locator("[role=dialog]").count() == 0, "| path", page.evaluate("location.pathname"))
    page.click(".card >> nth=0", force=True); page.wait_for_selector("[role=dialog]"); page.mouse.click(8, 8); page.wait_for_timeout(300)
    print("click outside closes:", page.locator("[role=dialog]").count() == 0)
    page.goto(f"{B}/p/pocket-weather-toy"); page.wait_for_selector("[role=dialog]")
    print("direct URL opens dialog:", page.locator("[role=dialog] h2").first.inner_text(), "| grid behind:", page.locator(".card").count())
    page.goto(f"{B}/p/hidden-draft"); page.wait_for_timeout(800)
    print("draft slug shows not-found:", "flew away" in page.locator("[role=dialog]").inner_text())
    page.goto(f"{B}/nope"); page.wait_for_timeout(500)
    print("unknown route 404 screen:", "flew away" in page.locator("main").inner_text())

    # easter eggs
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{B}/?hour=12"); page.wait_for_selector(".card")
    for _ in range(5): page.click(".brand"); page.wait_for_timeout(80)
    page.wait_for_selector(".toast"); print("logo x5 toast:", page.locator(".toast").inner_text())
    page.wait_for_timeout(3800)
    for k in ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]: page.keyboard.press(k)
    page.wait_for_selector(".toast"); print("konami toast:", page.locator(".toast").inner_text())
    page.wait_for_timeout(3800)
    info = page.evaluate("""() => { const c = document.querySelector('.cloud.special'); const r = c.getBoundingClientRect();
      const x = Math.min(innerWidth - 20, Math.max(20, r.left + r.width / 2)), y = Math.min(innerHeight - 20, Math.max(20, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y); return {x, y, onscreen: r.right > 0 && r.left < innerWidth, hit: hit && hit.closest('.cloud.special') ? 'special cloud' : (hit ? hit.tagName + '.' + hit.className : null)}; }""")
    print("special cloud hit-test:", info)
    page.click("text=Surprise me"); page.wait_for_selector("[role=dialog]"); print("Surprise me opened:", page.locator("[role=dialog] h2").first.inner_text())
    page.keyboard.press("Escape")
    page.click(".avatar"); page.wait_for_selector(".panel"); page.screenshot(path=f"{OUT}/profile.png", clip={"x": 700, "y": 0, "width": 580, "height": 330})
    page.keyboard.press("Escape")

    # mobile + reduced motion
    m = br.new_context(viewport={"width": 390, "height": 800}, reduced_motion="reduce", device_scale_factor=2)
    mp = m.new_page(); mp.goto(f"{B}/?hour=15"); mp.wait_for_selector(".card"); mp.wait_for_timeout(1200)
    print("mobile columns:", mp.evaluate("getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length"), "| h-scroll:", mp.evaluate("document.documentElement.scrollWidth > innerWidth"),
          "| animated card:", mp.evaluate("getComputedStyle(document.querySelector('.card')).animationName"))
    mp.screenshot(path=f"{OUT}/mobile.png")
    t = br.new_context(viewport={"width": 820, "height": 900}).new_page(); t.goto(f"{B}/?hour=12"); t.wait_for_selector(".card")
    print("tablet columns:", t.evaluate("getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length"))

    # admin
    page.goto(f"{B}/admin/projects"); page.wait_for_selector(".row-item"); page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/admin-projects.png")
    before = [x["title"] for x in api.get(B + "/api/admin/projects").json()["projects"]]
    page.locator(".handle").nth(0).focus(); page.keyboard.press("Space"); page.keyboard.press("ArrowDown"); page.keyboard.press("ArrowDown"); page.keyboard.press("Space"); page.wait_for_timeout(600)
    after = [x["title"] for x in api.get(B + "/api/admin/projects").json()["projects"]]
    print("keyboard reorder:", before[:3], "->", after[:3])
    page.fill("#q", "zzzz"); page.wait_for_timeout(300); print("empty search state:", "Nothing matches" in page.locator("main").inner_text()); page.fill("#q", "")
    page.goto(f"{B}/admin/projects/new"); page.wait_for_selector("#f-title"); page.screenshot(path=f"{OUT}/admin-editor.png")
    ap = ctx.new_page(); ap.goto(f"{B}/admin/appearance"); ap.wait_for_selector("input[type=checkbox]")
    ap.uncheck("text=Cloud animations"); ap.wait_for_timeout(500)
    print("appearance preview removes clouds live:", ap.locator(".cloud").count() == 0)
    anon = br.new_context().new_page(); anon.goto(f"{B}/admin"); anon.wait_for_selector("#pw"); print("anonymous /admin shows sign-in form:", True)
    anon.screenshot(path=f"{OUT}/admin-login.png")
    br.close()

print("\nconsole/page errors:", errors if errors else "none")

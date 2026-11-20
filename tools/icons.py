# App icons from the gallery art: a red seal with Yi Rui's portrait and a die.
import os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
por = Image.open(os.path.join(ROOT, 'assets', 'chars', 'yirui', 'portrait.png')).convert('RGBA')
def icon(n, path):
    im = Image.new('RGBA', (n, n), (192, 48, 42, 255)); d = ImageDraw.Draw(im)
    for y in range(n):
        k = y / n; d.line([(0, y), (n, y)], fill=(int(232 - 60 * k), int(80 - 40 * k), int(58 - 20 * k), 255))
    s = max(1, int(n * 0.62 / 56)); p = por.resize((48 * s, 56 * s), Image.NEAREST)
    im.alpha_composite(p, ((n - 48 * s) // 2 - n // 12, (n - 56 * s) // 2 + n // 20))
    r = n // 4; x0, y0 = n - r - n // 14, n // 14
    d.rounded_rectangle([x0, y0, x0 + r, y0 + r], radius=r // 5, fill=(255, 248, 232, 255), outline=(42, 26, 16, 255), width=max(2, n // 64))
    pr = max(2, r // 9)
    for px, py in [(0.3, 0.3), (0.7, 0.7), (0.5, 0.5)]:
        cx, cy = x0 + r * px, y0 + r * py; d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=(192, 48, 42, 255))
    im.convert('RGB').save(os.path.join(ROOT, path))
icon(192, 'icon-192.png'); icon(512, 'icon-512.png'); icon(180, 'apple-touch-icon.png')
print('icons ok')

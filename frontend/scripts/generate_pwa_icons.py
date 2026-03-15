import os
import zlib
import struct

PUBLIC = 'public'
ICON_DIR = os.path.join(PUBLIC, 'icons')
os.makedirs(ICON_DIR, exist_ok=True)


def make_png(path, width, height, rgb):
    # rgb: (r,g,b) 0-255
    filter_bytes = b'\x00'  # no filter
    row = filter_bytes + bytes(rgb) * width
    raw = row * height

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, level=9))
    png += chunk(b'IEND', b'')

    with open(path, 'wb') as f:
        f.write(png)

# Create a purple brand-like icon (blend of theme color)
make_png(os.path.join(ICON_DIR, 'icon-192.png'), 192, 192, (99, 102, 241))
make_png(os.path.join(ICON_DIR, 'icon-512.png'), 512, 512, (99, 102, 241))
make_png(os.path.join(ICON_DIR, 'apple-touch-icon.png'), 180, 180, (99, 102, 241))
print('Created icon files in', ICON_DIR)

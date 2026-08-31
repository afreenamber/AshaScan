"""Small test runner for the image-quality checks.

Scans `demo_images/`, runs `check_image_quality()` on each image, and prints
a simple table with results.
"""
import os
import glob
from src.preprocess import check_image_quality


def find_images(folder: str):
    exts = ["*.jpg", "*.jpeg", "*.png", "*.bmp", "*.tif", "*.tiff"]
    files = []
    for e in exts:
        files.extend(glob.glob(os.path.join(folder, e)))
    return sorted(files)


def main():
    folder = os.path.join(os.path.dirname(__file__), "..", "demo_images")
    folder = os.path.normpath(folder)
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)

    images = find_images(folder)
    if not images:
        print("No images found in", folder)
        print("Put sample images in the demo_images/ folder and re-run this script.")
        return

    print(f"Found {len(images)} images. Running quality checks...\n")
    print("filename,is_usable,issues,blur_score,brightness_score")
    for p in images:
        try:
            r = check_image_quality(p)
            issues_str = ";".join(r.get("issues", []))
            print(f"{os.path.basename(p)},{r['is_usable']},{issues_str},{r['blur_score']:.2f},{r['brightness_score']:.2f}")
        except Exception as e:
            print(f"{os.path.basename(p)},ERROR,{str(e)}")


if __name__ == "__main__":
    main()

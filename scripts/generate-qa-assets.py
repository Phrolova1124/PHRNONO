from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
QA_DIR = ROOT / "qa"
REFERENCE = ROOT.parent / "source-captures" / "frame-17.jpg"
RESAMPLING = Image.Resampling.LANCZOS


def fitted(path: Path, size: tuple[int, int]) -> Image.Image:
    with Image.open(path) as source:
        return ImageOps.fit(source.convert("RGB"), size, method=RESAMPLING)


def comparison(implementation_name: str, output_name: str) -> None:
    reference = fitted(REFERENCE, (1280, 720))
    implementation = fitted(QA_DIR / implementation_name, (1280, 720))
    canvas = Image.new("RGB", (2560, 720), "white")
    canvas.paste(reference, (0, 0))
    canvas.paste(implementation, (1280, 0))
    canvas.save(QA_DIR / output_name, optimize=True)


home = fitted(QA_DIR / "desktop-home.png", (1200, 630))
home.save(ROOT / "public" / "og-phrnono.png", optimize=True)

comparison("desktop-home.png", "reference-vs-home.png")
comparison("desktop-work.png", "reference-vs-work.png")
comparison("desktop-detail-food-stall-full.png", "reference-vs-detail.png")
comparison("desktop-404.png", "reference-vs-404.png")
comparison("desktop-scroll-expand-open.png", "reference-vs-scroll-expand.png")
comparison("desktop-character-design.png", "reference-vs-character-design.png")
comparison("desktop-route-transition-leaving.png", "reference-vs-route-transition.png")

from pathlib import Path
from typing import Callable, List, Optional
from pypdf import PdfReader

# Below this many characters, a page's pypdf-extracted text is treated as
# "no real text layer" (i.e. a scanned image page) and sent through OCR
# instead. Loaded lazily -- see _get_ocr_engine -- so a plain text-layer
# PDF never pays the cost of importing paddleocr or loading its models.
_MIN_TEXT_LAYER_CHARS = 20
_OCR_ENGINE = None

ProgressCallback = Optional[Callable[[int, int], None]]


class Ingester:
    @staticmethod
    def from_text(text: str) -> str:
        return text.strip()

    @staticmethod
    def from_markdown_file(path: Path) -> str:
        return path.read_text(encoding="utf-8")

    @staticmethod
    def from_pdf(path: Path, progress_callback: ProgressCallback = None) -> str:
        """Extracts text from a PDF, falling back to OCR per-page for scanned
        pages. Mixed PDFs (some real text pages, some scanned) are handled
        page-by-page rather than all-or-nothing."""
        reader = PdfReader(str(path))
        texts: List[str] = []
        scanned_pages: List[int] = []

        for i, page in enumerate(reader.pages):
            t = page.extract_text() or ""
            texts.append(t)
            if len(t.strip()) < _MIN_TEXT_LAYER_CHARS:
                scanned_pages.append(i)

        if scanned_pages:
            texts = Ingester._ocr_pages(path, texts, scanned_pages, progress_callback)

        return "\n\n".join(t for t in texts if t.strip())

    @staticmethod
    def _ocr_pages(
        path: Path, texts: List[str], page_indices: List[int], progress_callback: ProgressCallback
    ) -> List[str]:
        # PyMuPDF renders PDF pages to images without needing a system
        # binary like poppler installed (unlike pdf2image).
        import pymupdf

        doc = pymupdf.open(str(path))
        ocr = Ingester._get_ocr_engine()

        temp_dir = Path("data/ocr_pages")
        temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            for n, page_index in enumerate(page_indices, 1):
                if progress_callback:
                    progress_callback(n, len(page_indices))

                # 200 DPI balances OCR accuracy against render/inference time;
                # scanned religious texts are usually plain body text, not
                # tiny footnotes, so this is comfortably enough resolution.
                pixmap = doc[page_index].get_pixmap(dpi=200)
                img_path = temp_dir / f"page_{page_index}.png"
                pixmap.save(str(img_path))

                result = ocr.predict(str(img_path))
                recognized_lines: List[str] = []
                for page_result in result:
                    # predict() yields flat dict-like result objects
                    # ("rec_texts" at the top level) -- the "res" nesting
                    # only exists in .json/save_to_json output, not here.
                    recognized_lines.extend(page_result["rec_texts"])
                texts[page_index] = "\n".join(recognized_lines)

                img_path.unlink(missing_ok=True)
        finally:
            doc.close()

        return texts

    @staticmethod
    def _get_ocr_engine():
        global _OCR_ENGINE
        if _OCR_ENGINE is None:
            from paddleocr import PaddleOCR

            # The default PP-OCRv5 recognition model covers Simplified
            # Chinese, Traditional Chinese, English and Japanese in one
            # model -- no separate language pack needed for 繁體中文 content.
            # Doc-orientation/unwarping/textline-orientation stages are
            # disabled: scanned book pages are flat and upright, and
            # skipping these stages avoids needing the paddleocr "[all]"
            # extras (smaller install, faster first run).
            _OCR_ENGINE = PaddleOCR(
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        return _OCR_ENGINE

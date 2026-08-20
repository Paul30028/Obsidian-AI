from pathlib import Path
from pypdf import PdfReader

class Ingester:
    @staticmethod
    def from_text(text: str) -> str:
        return text.strip()

    @staticmethod
    def from_markdown_file(path: Path) -> str:
        return path.read_text(encoding="utf-8")

    @staticmethod
    def from_pdf(path: Path) -> str:
        reader = PdfReader(str(path))
        texts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                texts.append(t)
        return "\n\n".join(texts)

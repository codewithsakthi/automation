from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def markdown_to_story(markdown_text: str):
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        spaceAfter=10,
        textColor=colors.HexColor("#0B2E59"),
    )
    h1_style = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        spaceBefore=8,
        spaceAfter=6,
        textColor=colors.HexColor("#123E7A"),
    )
    h2_style = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        spaceBefore=6,
        spaceAfter=4,
        textColor=colors.HexColor("#1A4E96"),
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        spaceAfter=3,
    )
    mono_style = ParagraphStyle(
        "Mono",
        parent=body_style,
        fontName="Courier",
        fontSize=9,
        leading=12,
        backColor=colors.HexColor("#F3F5F7"),
        leftIndent=8,
        rightIndent=8,
    )

    story = []
    in_code_block = False

    for raw_line in markdown_text.splitlines():
        line = raw_line.rstrip()

        if line.startswith("```"):
            in_code_block = not in_code_block
            story.append(Spacer(1, 2))
            continue

        if in_code_block:
            if line.strip():
                safe_line = (
                    line.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                )
                story.append(Paragraph(safe_line, mono_style))
            else:
                story.append(Spacer(1, 2))
            continue

        if not line.strip():
            story.append(Spacer(1, 4))
            continue

        safe = (
            line.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

        if line.startswith("# "):
            story.append(Paragraph(safe[2:], title_style))
        elif line.startswith("## "):
            story.append(Paragraph(safe[3:], h1_style))
        elif line.startswith("### "):
            story.append(Paragraph(safe[4:], h2_style))
        elif line.startswith("- "):
            story.append(Paragraph(f"- {safe[2:]}", body_style))
        elif line[:2].isdigit() and line[1:3] == ". ":
            story.append(Paragraph(safe, body_style))
        else:
            story.append(Paragraph(safe, body_style))

    return story


def generate_pdf(markdown_path: Path, pdf_path: Path):
    markdown_text = markdown_path.read_text(encoding="utf-8")

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="SPARK Project Documentation",
        author="SPARK Project",
    )

    story = markdown_to_story(markdown_text)
    doc.build(story)


if __name__ == "__main__":
    docs_dir = Path(__file__).resolve().parent
    md_file = docs_dir / "PROJECT_DOCUMENTATION.md"
    pdf_file = docs_dir / "PROJECT_DOCUMENTATION.pdf"

    generate_pdf(md_file, pdf_file)
    print(f"PDF generated at: {pdf_file}")

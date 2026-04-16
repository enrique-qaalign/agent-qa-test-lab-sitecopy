import json
import sys
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem

input_path = Path(sys.argv[1] if len(sys.argv) > 1 else "out/advisory-report.json")
output_path = Path(sys.argv[2] if len(sys.argv) > 2 else "out/advisory-report.pdf")

report = json.loads(input_path.read_text())

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="SmallMuted", parent=styles["BodyText"], textColor=colors.HexColor("#5b6475"), leading=14))
styles.add(ParagraphStyle(name="SectionHeader", parent=styles["Heading2"], textColor=colors.HexColor("#1f2a44")))
styles.add(ParagraphStyle(name="Hero", parent=styles["Heading1"], textColor=colors.HexColor("#1f2a44"), fontSize=20, leading=24))

doc = SimpleDocTemplate(str(output_path), pagesize=letter, topMargin=40, bottomMargin=36, leftMargin=44, rightMargin=44)

story = []
story.append(Paragraph(report["title"], styles["Hero"]))
story.append(Spacer(1, 8))
story.append(Paragraph(report["executiveSummary"]["summary"], styles["BodyText"]))
story.append(Spacer(1, 12))

meta = report["executiveSummary"]
story.append(Paragraph(f"<b>Framework:</b> {meta['framework']}", styles["BodyText"]))
story.append(Paragraph(f"<b>Trust Level:</b> {meta['trustLevel']}", styles["BodyText"]))
story.append(Paragraph(f"<b>Path Recommendation:</b> {meta['pathRecommendation']}", styles["BodyText"]))
story.append(Paragraph(f"<b>Recommended Start Sprint:</b> {meta['recommendedStartSprint']}", styles["BodyText"]))
story.append(Spacer(1, 14))

for title, key in [
    ("Top Risks", "topRisks"),
    ("Technical Findings", "technicalFindings"),
    ("Recommended Roadmap", "roadmap"),
    ("Immediate Next Steps", "nextSteps"),
]:
    story.append(Paragraph(title, styles["SectionHeader"]))
    items = report.get(key, [])
    lf = ListFlowable(
        [ListItem(Paragraph(str(x), styles["BodyText"])) for x in items],
        bulletType="bullet",
        start="circle",
        leftIndent=16
    )
    story.append(lf)
    story.append(Spacer(1, 12))

doc.build(story)
print(f"Wrote {output_path}")

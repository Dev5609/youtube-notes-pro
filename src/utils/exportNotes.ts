import { Note } from "@/types/note";
import { jsPDF } from "jspdf";

export function downloadAsPDF(note: Note) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(note.title, contentWidth);
  doc.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 8 + 10;

  // Duration
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Duration: ${note.duration}`, margin, yPosition);
  yPosition += 15;

  // Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Summary", margin, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(note.summary, contentWidth);
  doc.text(summaryLines, margin, yPosition);
  yPosition += summaryLines.length * 6 + 10;

  // Key Points
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Key Points", margin, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  note.keyPoints.forEach((point) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = margin;
    }
    const pointLines = doc.splitTextToSize(`• ${point}`, contentWidth);
    doc.text(pointLines, margin, yPosition);
    yPosition += pointLines.length * 6 + 4;
  });
  yPosition += 6;

  // Sections
  note.sections.forEach((section) => {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin, yPosition);
    if (section.timestamp) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`[${section.timestamp}]`, margin + doc.getTextWidth(section.title) + 5, yPosition);
      doc.setTextColor(0);
    }
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const contentLines = doc.splitTextToSize(section.content, contentWidth);
    doc.text(contentLines, margin, yPosition);
    yPosition += contentLines.length * 6 + 10;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Made by Devansh | AI YouTube Notes", pageWidth / 2, 290, { align: "center" });
  }

  doc.save(`${note.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_notes.pdf`);
}

export function downloadAsMarkdown(note: Note) {
  let markdown = `# ${note.title}\n\n`;
  markdown += `**Duration:** ${note.duration}\n\n`;
  markdown += `**Video URL:** ${note.videoUrl}\n\n`;
  markdown += `---\n\n`;
  markdown += `## Summary\n\n${note.summary}\n\n`;
  markdown += `## Key Points\n\n`;
  note.keyPoints.forEach((point) => {
    markdown += `- ${point}\n`;
  });
  markdown += `\n## Detailed Notes\n\n`;
  note.sections.forEach((section) => {
    markdown += `### ${section.title}`;
    if (section.timestamp) {
      markdown += ` [${section.timestamp}]`;
    }
    markdown += `\n\n${section.content}\n\n`;
  });
  markdown += `---\n\n*Made by Devansh | AI YouTube Notes*\n`;

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${note.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_notes.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAsText(note: Note) {
  let text = `${note.title.toUpperCase()}\n${"=".repeat(note.title.length)}\n\n`;
  text += `Duration: ${note.duration}\n`;
  text += `Video URL: ${note.videoUrl}\n\n`;
  text += `${"─".repeat(40)}\n\n`;
  text += `SUMMARY\n${"─".repeat(7)}\n${note.summary}\n\n`;
  text += `KEY POINTS\n${"─".repeat(10)}\n`;
  note.keyPoints.forEach((point, i) => {
    text += `${i + 1}. ${point}\n`;
  });
  text += `\nDETAILED NOTES\n${"─".repeat(14)}\n\n`;
  note.sections.forEach((section) => {
    text += `${section.title}`;
    if (section.timestamp) {
      text += ` [${section.timestamp}]`;
    }
    text += `\n${"-".repeat(section.title.length)}\n${section.content}\n\n`;
  });
  text += `${"─".repeat(40)}\nMade by Devansh | AI YouTube Notes\n`;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${note.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

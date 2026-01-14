import { Note } from "@/types/note";
import { jsPDF } from "jspdf";

export function downloadAsPDF(note: Note) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;
  
  // Helper function to add a new page if needed
  const checkNewPage = (heightNeeded: number) => {
    if (yPosition + heightNeeded > pageHeight - 30) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // ===== COVER PAGE =====
  doc.setFillColor(20, 184, 166); // Teal color
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("VidBrief", pageWidth / 2, 35, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("AI-Generated Study Notes", pageWidth / 2, 48, { align: "center" });
  
  yPosition = 80;
  
  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  const titleLines = doc.splitTextToSize(note.title, contentWidth);
  doc.text(titleLines, pageWidth / 2, yPosition, { align: "center" });
  yPosition += titleLines.length * 10 + 15;
  
  // Video Info Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPosition, contentWidth, 25, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Duration: ${note.duration}`, margin + 10, yPosition + 10);
  doc.text(`Video URL: ${note.videoUrl}`, margin + 10, yPosition + 18);
  yPosition += 40;
  
  // ===== TABLE OF CONTENTS PAGE =====
  doc.addPage();
  yPosition = margin;
  
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 0, pageWidth, 8, 'F');
  
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Table of Contents", margin, yPosition + 15);
  yPosition += 30;
  
  // Draw TOC line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;
  
  let tocPageNum = 3; // Starting page for content
  
  // TOC entries
  doc.setFontSize(11);
  const tocEntries = [
    { title: "Summary", page: tocPageNum },
    { title: "Key Points", page: tocPageNum },
  ];
  
  // Estimate pages for sections
  note.sections.forEach((section, index) => {
    tocEntries.push({ title: section.title, page: tocPageNum + Math.floor((index + 2) / 3) });
  });
  
  tocEntries.forEach((entry, index) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    
    doc.text(`${index + 1}. ${entry.title}`, margin, yPosition);
    doc.setTextColor(100, 100, 100);
    doc.text(`${entry.page}`, pageWidth - margin, yPosition, { align: "right" });
    
    yPosition += 8;
  });
  
  // ===== CONTENT PAGES =====
  doc.addPage();
  yPosition = margin;
  
  // Header bar on each page
  const addPageHeader = () => {
    doc.setFillColor(20, 184, 166);
    doc.rect(0, 0, pageWidth, 8, 'F');
  };
  
  addPageHeader();
  yPosition = 20;
  
  // Summary Section
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 184, 166);
  doc.text("📋 Summary", margin, yPosition);
  yPosition += 10;
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const summaryLines = doc.splitTextToSize(note.summary, contentWidth);
  
  summaryLines.forEach((line: string) => {
    checkNewPage(8);
    doc.text(line, margin, yPosition);
    yPosition += 6;
  });
  yPosition += 10;
  
  // Key Points Section
  checkNewPage(30);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 184, 166);
  doc.text("🎯 Key Points", margin, yPosition);
  yPosition += 10;
  
  doc.setFontSize(11);
  note.keyPoints.forEach((point) => {
    checkNewPage(15);
    
    // Bullet point circle
    doc.setFillColor(20, 184, 166);
    doc.circle(margin + 3, yPosition - 2, 2, 'F');
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const pointLines = doc.splitTextToSize(point, contentWidth - 15);
    pointLines.forEach((line: string) => {
      doc.text(line, margin + 10, yPosition);
      yPosition += 6;
    });
    yPosition += 4;
  });
  yPosition += 10;
  
  // Detailed Sections
  note.sections.forEach((section, sectionIndex) => {
    checkNewPage(40);
    
    if (yPosition > 30) {
      // Section divider
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;
    }
    
    // Section header with number
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(margin, yPosition - 5, contentWidth, 18, 2, 2, 'F');
    
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 184, 166);
    doc.text(`${sectionIndex + 1}. ${section.title}`, margin + 5, yPosition + 5);
    
    if (section.timestamp) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const timestampWidth = doc.getTextWidth(`[${section.timestamp}]`);
      doc.text(`[${section.timestamp}]`, pageWidth - margin - timestampWidth - 5, yPosition + 5);
    }
    yPosition += 20;
    
    // Section content
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const contentLines = doc.splitTextToSize(section.content, contentWidth - 10);
    
    contentLines.forEach((line: string) => {
      if (checkNewPage(8)) {
        addPageHeader();
        yPosition = 20;
      }
      doc.text(line, margin + 5, yPosition);
      yPosition += 6;
    });
    yPosition += 15;
  });
  
  // ===== FOOTER ON ALL PAGES =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("Made by Devansh | VidBrief - AI YouTube Notes", margin, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  const fileName = `${note.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_notes.pdf`;
  doc.save(fileName);
}

export function downloadAsMarkdown(note: Note) {
  let markdown = `# ${note.title}\n\n`;
  markdown += `> **Duration:** ${note.duration}  \n`;
  markdown += `> **Video URL:** [Watch Video](${note.videoUrl})  \n`;
  markdown += `> **Generated by:** VidBrief\n\n`;
  markdown += `---\n\n`;
  
  // Table of Contents
  markdown += `## 📑 Table of Contents\n\n`;
  markdown += `1. [Summary](#summary)\n`;
  markdown += `2. [Key Points](#key-points)\n`;
  note.sections.forEach((section, index) => {
    const anchor = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    markdown += `${index + 3}. [${section.title}](#${anchor})\n`;
  });
  markdown += `\n---\n\n`;
  
  // Summary
  markdown += `## 📋 Summary\n\n${note.summary}\n\n`;
  
  // Key Points
  markdown += `## 🎯 Key Points\n\n`;
  note.keyPoints.forEach((point) => {
    markdown += `- ✅ ${point}\n`;
  });
  markdown += `\n`;
  
  // Detailed Notes
  markdown += `## 📚 Detailed Notes\n\n`;
  note.sections.forEach((section, index) => {
    markdown += `### ${index + 1}. ${section.title}`;
    if (section.timestamp) {
      markdown += ` \`[${section.timestamp}]\``;
    }
    markdown += `\n\n${section.content}\n\n`;
  });
  
  markdown += `---\n\n`;
  markdown += `*Made by Devansh | VidBrief - AI YouTube Notes*\n`;

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${note.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_notes.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAsText(note: Note) {
  const width = 70;
  const divider = "═".repeat(width);
  const thinDivider = "─".repeat(width);
  
  let text = `\n${divider}\n`;
  text += `  VidBrief - AI YOUTUBE NOTES\n`;
  text += `${divider}\n\n`;
  
  text += `${note.title.toUpperCase()}\n`;
  text += `${"─".repeat(note.title.length)}\n\n`;
  
  text += `Duration: ${note.duration}\n`;
  text += `Video URL: ${note.videoUrl}\n\n`;
  
  text += `${thinDivider}\n`;
  text += `  TABLE OF CONTENTS\n`;
  text += `${thinDivider}\n\n`;
  
  text += `  1. Summary\n`;
  text += `  2. Key Points\n`;
  note.sections.forEach((section, index) => {
    text += `  ${index + 3}. ${section.title}\n`;
  });
  text += `\n${thinDivider}\n\n`;
  
  text += `📋 SUMMARY\n${thinDivider}\n${note.summary}\n\n`;
  
  text += `🎯 KEY POINTS\n${thinDivider}\n`;
  note.keyPoints.forEach((point, i) => {
    text += `  ${i + 1}. ${point}\n`;
  });
  text += `\n`;
  
  text += `📚 DETAILED NOTES\n${thinDivider}\n\n`;
  note.sections.forEach((section, index) => {
    text += `[${index + 1}] ${section.title}`;
    if (section.timestamp) {
      text += ` [${section.timestamp}]`;
    }
    text += `\n${"-".repeat(section.title.length + 4)}\n${section.content}\n\n`;
  });
  
  text += `${divider}\n`;
  text += `Made by Devansh | VidBrief - AI YouTube Notes\n`;
  text += `${divider}\n`;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${note.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}_notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

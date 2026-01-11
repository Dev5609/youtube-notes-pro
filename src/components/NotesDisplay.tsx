import { motion } from "framer-motion";
import { FileText, Download, Clock, BookOpen, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";

interface Note {
  title: string;
  videoUrl: string;
  duration: string;
  summary: string;
  keyPoints: string[];
  sections: {
    title: string;
    content: string;
    timestamp?: string;
  }[];
}

interface NotesDisplayProps {
  notes: Note;
}

export function NotesDisplay({ notes }: NotesDisplayProps) {
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(notes.title, contentWidth);
    doc.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 8 + 10;

    // Duration
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Duration: ${notes.duration}`, margin, yPosition);
    yPosition += 15;

    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Summary", margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(notes.summary, contentWidth);
    doc.text(summaryLines, margin, yPosition);
    yPosition += summaryLines.length * 6 + 10;

    // Key Points
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Points", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    notes.keyPoints.forEach((point) => {
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
    notes.sections.forEach((section) => {
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

    doc.save(`${notes.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}_notes.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-card rounded-3xl shadow-card border border-border overflow-hidden">
        {/* Header */}
        <div className="gradient-primary p-6 text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-2">
                <FileText className="w-4 h-4" />
                <span>AI Generated Notes</span>
              </div>
              <h2 className="text-2xl font-display font-bold leading-tight">
                {notes.title}
              </h2>
              <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {notes.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {notes.sections.length} sections
                </span>
              </div>
            </div>
            <Button
              onClick={handleDownloadPDF}
              className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground backdrop-blur-sm border border-primary-foreground/20"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Summary */}
          <section>
            <h3 className="text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full gradient-primary" />
              Summary
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {notes.summary}
            </p>
          </section>

          {/* Key Points */}
          <section>
            <h3 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full gradient-primary" />
              Key Points
            </h3>
            <ul className="space-y-3">
              {notes.keyPoints.map((point, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{point}</span>
                </motion.li>
              ))}
            </ul>
          </section>

          {/* Detailed Sections */}
          <section>
            <h3 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full gradient-primary" />
              Detailed Notes
            </h3>
            <div className="space-y-6">
              {notes.sections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="pl-4 border-l-2 border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-foreground">{section.title}</h4>
                    {section.timestamp && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                        {section.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {section.content}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

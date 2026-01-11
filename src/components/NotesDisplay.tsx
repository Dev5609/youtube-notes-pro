import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Clock,
  BookOpen,
  CheckCircle,
  Edit3,
  Save,
  X,
  FileDown,
  FileType,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Note } from "@/types/note";
import { downloadAsPDF, downloadAsMarkdown, downloadAsText } from "@/utils/exportNotes";
import { toast } from "sonner";

interface NotesDisplayProps {
  notes: Note;
  onUpdate?: (notes: Note) => void;
}

export function NotesDisplay({ notes, onUpdate }: NotesDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState<Note>(notes);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedNotes);
    }
    setIsEditing(false);
    toast.success("Notes updated!");
  };

  const handleCancel = () => {
    setEditedNotes(notes);
    setIsEditing(false);
  };

  const handleDownload = (format: "pdf" | "markdown" | "text") => {
    const noteToExport = isEditing ? editedNotes : notes;
    switch (format) {
      case "pdf":
        downloadAsPDF(noteToExport);
        toast.success("PDF downloaded!");
        break;
      case "markdown":
        downloadAsMarkdown(noteToExport);
        toast.success("Markdown file downloaded!");
        break;
      case "text":
        downloadAsText(noteToExport);
        toast.success("Text file downloaded!");
        break;
    }
  };

  const updateSection = (index: number, field: "title" | "content", value: string) => {
    const newSections = [...editedNotes.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setEditedNotes({ ...editedNotes, sections: newSections });
  };

  const updateKeyPoint = (index: number, value: string) => {
    const newKeyPoints = [...editedNotes.keyPoints];
    newKeyPoints[index] = value;
    setEditedNotes({ ...editedNotes, keyPoints: newKeyPoints });
  };

  const displayNotes = isEditing ? editedNotes : notes;

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
              {isEditing ? (
                <Input
                  value={editedNotes.title}
                  onChange={(e) => setEditedNotes({ ...editedNotes, title: e.target.value })}
                  className="text-2xl font-display font-bold bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
                />
              ) : (
                <h2 className="text-2xl font-display font-bold leading-tight">
                  {displayNotes.title}
                </h2>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {displayNotes.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {displayNotes.sections.length} sections
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleCancel}
                    variant="ghost"
                    className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="ghost"
                    className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground backdrop-blur-sm border border-primary-foreground/20">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Download as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload("markdown")}>
                        <FileCode className="w-4 h-4 mr-2" />
                        Download as Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload("text")}>
                        <FileType className="w-4 h-4 mr-2" />
                        Download as Text
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
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
            {isEditing ? (
              <Textarea
                value={editedNotes.summary}
                onChange={(e) => setEditedNotes({ ...editedNotes, summary: e.target.value })}
                className="min-h-[120px]"
              />
            ) : (
              <p className="text-muted-foreground leading-relaxed">{displayNotes.summary}</p>
            )}
          </section>

          {/* Key Points */}
          <section>
            <h3 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full gradient-primary" />
              Key Points
            </h3>
            <ul className="space-y-3">
              {displayNotes.keyPoints.map((point, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  {isEditing ? (
                    <Input
                      value={point}
                      onChange={(e) => updateKeyPoint(index, e.target.value)}
                      className="flex-1"
                    />
                  ) : (
                    <span className="text-foreground">{point}</span>
                  )}
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
              {displayNotes.sections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="pl-4 border-l-2 border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isEditing ? (
                      <Input
                        value={section.title}
                        onChange={(e) => updateSection(index, "title", e.target.value)}
                        className="font-semibold"
                      />
                    ) : (
                      <h4 className="font-semibold text-foreground">{section.title}</h4>
                    )}
                    {section.timestamp && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                        {section.timestamp}
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={section.content}
                      onChange={(e) => updateSection(index, "content", e.target.value)}
                      className="min-h-[100px]"
                    />
                  ) : (
                    <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

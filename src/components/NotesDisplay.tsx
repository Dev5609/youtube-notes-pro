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
  ChevronDown,
  ChevronUp,
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
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2]));

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

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const displayNotes = isEditing ? editedNotes : notes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-card rounded-2xl sm:rounded-3xl shadow-card border border-border overflow-hidden">
        {/* Header */}
        <div className="gradient-primary p-4 sm:p-6 text-primary-foreground">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-primary-foreground/80 text-xs sm:text-sm mb-2">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>AI Generated Notes</span>
              </div>
              {isEditing ? (
                <Input
                  value={editedNotes.title}
                  onChange={(e) => setEditedNotes({ ...editedNotes, title: e.target.value })}
                  className="text-lg sm:text-2xl font-display font-bold bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
                />
              ) : (
                <h2 className="text-lg sm:text-2xl font-display font-bold leading-tight break-words">
                  {displayNotes.title}
                </h2>
              )}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm text-primary-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {displayNotes.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {displayNotes.sections.length} sections
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleCancel}
                    variant="ghost"
                    size="sm"
                    className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Save</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="ghost"
                    size="sm"
                    className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        size="sm"
                        className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground backdrop-blur-sm border border-primary-foreground/20 text-xs sm:text-sm h-8 sm:h-9"
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Export</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-popover border-border z-50">
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
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
          {/* Summary */}
          <section>
            <h3 className="text-base sm:text-lg font-display font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2">
              <div className="w-1 sm:w-1.5 h-4 sm:h-5 rounded-full gradient-primary" />
              Summary
            </h3>
            {isEditing ? (
              <Textarea
                value={editedNotes.summary}
                onChange={(e) => setEditedNotes({ ...editedNotes, summary: e.target.value })}
                className="min-h-[100px] sm:min-h-[120px] text-sm sm:text-base"
              />
            ) : (
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{displayNotes.summary}</p>
            )}
          </section>

          {/* Key Points */}
          <section>
            <h3 className="text-base sm:text-lg font-display font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
              <div className="w-1 sm:w-1.5 h-4 sm:h-5 rounded-full gradient-primary" />
              Key Points
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              {displayNotes.keyPoints.map((point, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-2 sm:gap-3"
                >
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                  {isEditing ? (
                    <Input
                      value={point}
                      onChange={(e) => updateKeyPoint(index, e.target.value)}
                      className="flex-1 text-sm sm:text-base"
                    />
                  ) : (
                    <span className="text-sm sm:text-base text-foreground">{point}</span>
                  )}
                </motion.li>
              ))}
            </ul>
          </section>

          {/* Detailed Sections */}
          <section>
            <h3 className="text-base sm:text-lg font-display font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
              <div className="w-1 sm:w-1.5 h-4 sm:h-5 rounded-full gradient-primary" />
              Detailed Notes
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {displayNotes.sections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => !isEditing && toggleSection(index)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 bg-accent/30 hover:bg-accent/50 transition-colors text-left"
                    disabled={isEditing}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {index + 1}
                      </span>
                      {isEditing ? (
                        <Input
                          value={section.title}
                          onChange={(e) => updateSection(index, "title", e.target.value)}
                          className="font-semibold text-sm sm:text-base"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{section.title}</h4>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {section.timestamp && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground hidden sm:inline">
                          {section.timestamp}
                        </span>
                      )}
                      {!isEditing && (
                        expandedSections.has(index) ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )
                      )}
                    </div>
                  </button>
                  
                  {(isEditing || expandedSections.has(index)) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-3 sm:p-4 border-t border-border"
                    >
                      {section.timestamp && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground sm:hidden inline-block mb-2">
                          {section.timestamp}
                        </span>
                      )}
                      {isEditing ? (
                        <Textarea
                          value={section.content}
                          onChange={(e) => updateSection(index, "content", e.target.value)}
                          className="min-h-[80px] sm:min-h-[100px] text-sm sm:text-base"
                        />
                      ) : (
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {section.content}
                        </p>
                      )}
                    </motion.div>
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

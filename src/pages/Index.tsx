import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { YouTubeInput } from "@/components/YouTubeInput";
import { NotesDisplay } from "@/components/NotesDisplay";
import { AuthModal } from "@/components/AuthModal";
import { HistorySidebar } from "@/components/HistorySidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Note } from "@/types/note";
import { toast } from "sonner";

const Index = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleGenerate = async (url: string, videoType: string) => {
    setIsLoading(true);
    setNotes(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-notes", {
        body: { videoUrl: url, videoType },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error(error.message || "Failed to generate notes");
        return;
      }

      if (!data?.success || !data?.notes) {
        toast.error(data?.error || "Failed to generate notes");
        return;
      }

      const generatedNote: Note = {
        videoUrl: url,
        title: data.notes.title,
        duration: data.notes.duration || "Unknown",
        summary: data.notes.summary,
        keyPoints: data.notes.keyPoints || [],
        sections: data.notes.sections || [],
      };

      setNotes(generatedNote);
      toast.success("Notes generated successfully!");

      // Save to database if user is logged in
      if (user) {
        await saveNote(generatedNote);
      }
    } catch (error) {
      console.error("Error generating notes:", error);
      toast.error("Failed to generate notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async (note: Note) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.from("notes").insert({
        user_id: user.id,
        video_url: note.videoUrl,
        video_title: note.title,
        duration: note.duration,
        summary: note.summary,
        key_points: note.keyPoints,
        sections: note.sections,
      }).select().single();

      if (error) throw error;

      // Update local note with ID from database
      setNotes({ ...note, id: data.id, created_at: data.created_at });
      toast.success("Note saved to your history!");
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    setNotes(updatedNote);

    if (user && updatedNote.id) {
      try {
        const { error } = await supabase
          .from("notes")
          .update({
            video_title: updatedNote.title,
            summary: updatedNote.summary,
            key_points: updatedNote.keyPoints,
            sections: updatedNote.sections,
          })
          .eq("id", updatedNote.id);

        if (error) throw error;
      } catch (error) {
        console.error("Error updating note:", error);
        toast.error("Failed to save changes");
      }
    }
  };

  const handleSelectNote = (note: Note) => {
    setNotes(note);
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <Header onOpenHistory={() => setIsHistoryOpen(true)} onOpenAuth={() => setIsAuthOpen(true)} />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-12">
        <div className="max-w-6xl mx-auto">
          <HeroSection />
          <YouTubeInput onGenerate={handleGenerate} isLoading={isLoading} />

          {!user && !isLoading && !notes && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8"
            >
              <button onClick={() => setIsAuthOpen(true)} className="text-primary hover:underline">
                Sign in
              </button>{" "}
              to save notes to your history
            </motion.p>
          )}

          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-10 sm:mt-16 text-center"
              >
                <div className="inline-flex flex-col items-center gap-4">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                    <div className="absolute inset-0 rounded-full gradient-primary opacity-20 animate-ping" />
                    <div className="absolute inset-2 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
                      <span className="text-primary-foreground text-lg sm:text-xl">✨</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium text-sm sm:text-base">
                      AI is analyzing your video...
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
                      Fetching transcript and generating comprehensive notes
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {notes && !isLoading && (
              <motion.div
                key="notes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-10 sm:mt-16"
              >
                <NotesDisplay notes={notes} onUpdate={handleUpdateNote} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectNote={handleSelectNote}
      />
    </div>
  );
};

export default Index;

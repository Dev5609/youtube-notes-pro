import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Youtube, Sparkles, Loader2, Check, ChevronDown, GraduationCap, Heart, Wrench, BookOpen, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface YouTubeInputProps {
  onGenerate: (url: string, videoType: string) => void;
  isLoading: boolean;
}

const videoTypes = [
  { value: "Academic Lecture", label: "Academic Lecture", description: "University courses, educational content", icon: GraduationCap },
  { value: "Motivational", label: "Motivational", description: "Inspirational, humanitarian talks", icon: Heart },
  { value: "Tutorial", label: "Tutorial", description: "How-to guides, practical lessons", icon: Wrench },
  { value: "Review Session", label: "Review Session", description: "Revision, exam preparation", icon: BookOpen },
  { value: "Q&A Format", label: "Q&A Format", description: "Question and answer sessions", icon: MessageSquare },
  { value: "General", label: "General", description: "No specific category", icon: FileText },
];

export function YouTubeInput({ onGenerate, isLoading }: YouTubeInputProps) {
  const [url, setUrl] = useState("");
  const [videoType, setVideoType] = useState("General");
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value.trim()) {
      setIsValid(validateYouTubeUrl(value));
    } else {
      setIsValid(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    if (!validateYouTubeUrl(url)) {
      toast.error("Please enter a valid YouTube URL");
      return;
    }

    onGenerate(url, videoType);
  };

  const selectedType = videoTypes.find(t => t.value === videoType) || videoTypes[5];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-2xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* URL Input */}
        <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-2 sm:p-2 bg-card rounded-2xl shadow-card border border-border transition-all duration-300 focus-within:shadow-glow focus-within:border-primary/50">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex-shrink-0">
              <Youtube className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            
            <Input
              type="text"
              placeholder="Paste your YouTube video URL here..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base h-10 sm:h-12"
              disabled={isLoading}
            />
            
            <AnimatePresence>
              {isValid !== null && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`flex-shrink-0 ${isValid ? 'text-green-500' : 'text-destructive'}`}
                >
                  {isValid && <Check className="w-5 h-5" />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <Button
            type="submit"
            disabled={isLoading || !isValid}
            className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-soft hover:shadow-glow transition-all duration-300 disabled:opacity-70 w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
                <span className="sm:hidden">Loading...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Generate Notes
              </>
            )}
          </Button>
        </div>

        {/* Validation indicator */}
        <AnimatePresence>
          {isValid !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-4"
            >
              {isValid ? (
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Valid YouTube link
                </span>
              ) : (
                <span className="text-sm text-destructive">
                  Invalid YouTube link
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Type Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-12 sm:h-14 rounded-xl border-border bg-card hover:bg-accent/50 transition-all"
              disabled={isLoading}
            >
              <div className="flex items-center gap-3">
                <selectedType.icon className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <div className="font-medium text-foreground">{selectedType.label}</div>
                  <div className="text-xs text-muted-foreground hidden sm:block">{selectedType.description}</div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-[calc(100vw-3rem)] sm:w-[500px] p-2 bg-popover border-border z-50"
          >
            {videoTypes.map((type) => (
              <DropdownMenuItem
                key={type.value}
                onClick={() => setVideoType(type.value)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                  videoType === type.value ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <type.icon className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
                {videoType === type.value && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </form>
      
      <p className="text-center text-xs sm:text-sm text-muted-foreground mt-4">
        Supports YouTube videos with captions/transcripts for best results
      </p>
    </motion.div>
  );
}

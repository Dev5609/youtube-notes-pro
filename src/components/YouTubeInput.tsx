import { useState } from "react";
import { motion } from "framer-motion";
import { Youtube, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface YouTubeInputProps {
  onGenerate: (url: string) => void;
  isLoading: boolean;
}

export function YouTubeInput({ onGenerate, isLoading }: YouTubeInputProps) {
  const [url, setUrl] = useState("");

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
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

    onGenerate(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-2xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center gap-3 p-2 bg-card rounded-2xl shadow-card border border-border transition-all duration-300 focus-within:shadow-glow focus-within:border-primary/50">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 flex-shrink-0 ml-1">
            <Youtube className="w-6 h-6 text-primary" />
          </div>
          
          <Input
            type="text"
            placeholder="Paste your YouTube video URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-base h-12"
            disabled={isLoading}
          />
          
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 px-6 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-soft hover:shadow-glow transition-all duration-300 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Notes
              </>
            )}
          </Button>
        </div>
      </form>
      
      <p className="text-center text-sm text-muted-foreground mt-4">
        Supports YouTube videos, shorts, and playlists
      </p>
    </motion.div>
  );
}

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const loadingStages = [
  { progress: 5, message: "Connecting to video...", duration: 800 },
  { progress: 15, message: "Fetching transcript...", duration: 2500 },
  { progress: 30, message: "Analyzing content...", duration: 2000 },
  { progress: 45, message: "Identifying key topics...", duration: 2500 },
  { progress: 60, message: "Synthesizing notes...", duration: 3000 },
  { progress: 75, message: "Structuring sections...", duration: 2500 },
  { progress: 85, message: "Formatting content...", duration: 2000 },
  { progress: 92, message: "Preparing detailed PDF...", duration: 1500 },
  { progress: 96, message: "Almost there...", duration: 3000 },
];

interface LoadingProgressProps {
  isLoading: boolean;
}

export function LoadingProgress({ isLoading }: LoadingProgressProps) {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStage(0);
      setProgress(0);
      return;
    }

    let stageIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advanceStage = () => {
      if (stageIndex < loadingStages.length) {
        const stage = loadingStages[stageIndex];
        setCurrentStage(stageIndex);
        setProgress(stage.progress);
        stageIndex++;
        timeoutId = setTimeout(advanceStage, stage.duration);
      }
    };

    advanceStage();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  const currentMessage = loadingStages[currentStage]?.message || "Processing...";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mt-10 sm:mt-16 w-full max-w-md mx-auto"
    >
      <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-card border border-border">
        <div className="flex flex-col items-center gap-5">
          {/* Animated icon */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16">
            <div className="absolute inset-0 rounded-full gradient-primary opacity-20 animate-ping" />
            <div className="absolute inset-2 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
              <span className="text-primary-foreground text-lg sm:text-xl">✨</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-3">
            <Progress value={progress} className="h-3 bg-secondary" />
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <motion.span
                key={currentMessage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-muted-foreground font-medium"
              >
                {currentMessage}
              </motion.span>
              <span className="text-primary font-semibold">{progress}%</span>
            </div>
          </div>

          {/* Tip */}
          <p className="text-xs text-muted-foreground/70 text-center mt-2">
            This may take 15-45 seconds depending on video length
          </p>
        </div>
      </div>
    </motion.div>
  );
}

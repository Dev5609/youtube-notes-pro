import { motion } from "framer-motion";
import { Sparkles, FileText, Zap } from "lucide-react";

export function HeroSection() {
  const features = [
    { icon: Sparkles, text: "AI-Powered" },
    { icon: FileText, text: "Detailed Notes" },
    { icon: Zap, text: "Instant PDF" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center mb-12"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6"
      >
        <Sparkles className="w-4 h-4" />
        Transform YouTube Videos into Smart Notes
      </motion.div>

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-4 leading-tight">
        Learn Smarter with{" "}
        <span className="text-gradient">AI Notes</span>
      </h1>

      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
        Paste any YouTube video link and get comprehensive, well-structured notes 
        instantly. Download as PDF and learn at your own pace.
      </p>

      <div className="flex items-center justify-center gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <feature.icon className="w-4 h-4 text-primary" />
            <span>{feature.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="w-full py-4 sm:py-6 mt-auto"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          Made with <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary fill-primary" /> by{" "}
          <span className="font-semibold text-foreground"><a href="https://devanshgoel.vercel.app">Devansh</a></span>
        </p>
      </div>
    </motion.footer>
  );
}

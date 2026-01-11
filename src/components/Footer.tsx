import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="w-full py-6 mt-auto"
    >
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          Made with <Heart className="w-4 h-4 text-primary fill-primary" /> by{" "}
          <span className="font-semibold text-foreground">Devansh</span>
        </p>
      </div>
    </motion.footer>
  );
}

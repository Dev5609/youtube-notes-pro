import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const mockCounts = [12, 27, 35, 18, 42, 31, 24, 38, 21, 29, 33, 16, 45, 22, 37];

export function OnlineUsers() {
  const [count, setCount] = useState(() => mockCounts[Math.floor(Math.random() * mockCounts.length)]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly adjust count by -3 to +5
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 9) - 3;
        const newCount = prev + delta;
        return Math.max(8, Math.min(50, newCount));
      });
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
      <motion.div
        className="relative flex items-center justify-center"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
      >
        {/* Outer pulse ring */}
        <motion.span
          className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-success/30"
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.7, 0, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Inner dot */}
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-success shadow-sm" />
      </motion.div>
      <motion.span
        key={count}
        initial={{ opacity: 0.5, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-medium"
      >
        {count} online
      </motion.span>
    </div>
  );
}

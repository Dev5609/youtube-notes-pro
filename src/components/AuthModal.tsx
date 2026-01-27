import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const navigate = useNavigate();

  const handleGoToAuth = () => {
    onClose();
    navigate("/auth");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-md overflow-hidden"
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                  Sign In Required
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Save your notes with SummarIQ
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-muted-foreground mb-6">
              Sign in or create an account to save your generated notes and access them anytime.
            </p>

            <Button
              onClick={handleGoToAuth}
              className="w-full h-12 gradient-primary text-primary-foreground gap-2"
            >
              Continue to Sign In
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

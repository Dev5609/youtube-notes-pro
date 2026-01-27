import { motion } from "framer-motion";
import { BookOpen, History, User, LogOut, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { OnlineUsers } from "./OnlineUsers";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenAuth: () => void;
}

export function Header({ onOpenHistory, onOpenAuth }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full py-3 sm:py-4 px-4 sm:px-6"
    >
      <div className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-lg sm:text-xl text-foreground">
            SummarIQ
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-3">
          <OnlineUsers />
          
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenHistory}
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </Button>
          )}
          
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden md:inline max-w-[150px] truncate">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-9 w-9"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenAuth}
              className="flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Sign In</span>
            </Button>
          )}
          
          <ThemeToggle />
        </div>

        {/* Mobile Navigation */}
        <div className="flex sm:hidden items-center gap-2">
          <OnlineUsers />
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border z-50">
              {user ? (
                <>
                  <DropdownMenuItem className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenHistory}>
                    <History className="w-4 h-4 mr-2" />
                    History
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={onOpenAuth}>
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}

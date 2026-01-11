import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { YouTubeInput } from "@/components/YouTubeInput";
import { NotesDisplay } from "@/components/NotesDisplay";
import { toast } from "sonner";

// Mock notes data - in production, this would come from an AI API
const generateMockNotes = (url: string) => ({
  title: "Complete Guide to Modern Web Development with React",
  videoUrl: url,
  duration: "45:32",
  summary:
    "This comprehensive video tutorial covers the essential concepts of modern web development using React.js. From setting up your development environment to deploying production-ready applications, you'll learn industry best practices, state management patterns, and performance optimization techniques that are crucial for building scalable web applications.",
  keyPoints: [
    "React fundamentals: Components, JSX, and the Virtual DOM",
    "State management with hooks: useState, useEffect, and custom hooks",
    "Building reusable component libraries with proper TypeScript typing",
    "Performance optimization techniques including code splitting and lazy loading",
    "Best practices for project structure and code organization",
    "Testing strategies with Jest and React Testing Library",
  ],
  sections: [
    {
      title: "Introduction to React",
      timestamp: "0:00",
      content:
        "React is a declarative, efficient, and flexible JavaScript library for building user interfaces. It lets you compose complex UIs from small and isolated pieces of code called components. The library was developed by Facebook and is now maintained by Meta and a community of developers.",
    },
    {
      title: "Setting Up Your Development Environment",
      timestamp: "5:23",
      content:
        "Before starting with React, you need to set up your development environment. This includes installing Node.js, npm or yarn, and creating a new React project using Create React App or Vite. Vite is recommended for its faster build times and modern development experience.",
    },
    {
      title: "Understanding Components and Props",
      timestamp: "12:45",
      content:
        "Components are the building blocks of any React application. They accept inputs called props and return React elements describing what should appear on the screen. Components can be written as functions or classes, with functional components being the modern standard.",
    },
    {
      title: "State Management with Hooks",
      timestamp: "22:10",
      content:
        "React Hooks allow you to use state and other React features without writing a class. The useState hook lets you add state to functional components, while useEffect handles side effects like data fetching, subscriptions, or DOM manipulation.",
    },
    {
      title: "Building Production-Ready Applications",
      timestamp: "35:50",
      content:
        "Deploying a React application involves building an optimized production bundle, configuring environment variables, and choosing a hosting platform. Popular options include Vercel, Netlify, and AWS Amplify, each offering different features for different use cases.",
    },
    {
      title: "Conclusion and Next Steps",
      timestamp: "42:15",
      content:
        "After mastering these fundamentals, you can explore advanced topics like server-side rendering with Next.js, state management with Redux or Zustand, and building full-stack applications with backend frameworks. Continue practicing by building real projects.",
    },
  ],
});

const Index = () => {
  const [notes, setNotes] = useState<ReturnType<typeof generateMockNotes> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (url: string) => {
    setIsLoading(true);
    setNotes(null);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      const generatedNotes = generateMockNotes(url);
      setNotes(generatedNotes);
      toast.success("Notes generated successfully!");
    } catch (error) {
      toast.error("Failed to generate notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <Header />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <HeroSection />
          <YouTubeInput onGenerate={handleGenerate} isLoading={isLoading} />

          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-16 text-center"
              >
                <div className="inline-flex flex-col items-center gap-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full gradient-primary opacity-20 animate-ping" />
                    <div className="absolute inset-2 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
                      <span className="text-primary-foreground text-xl">✨</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground font-medium">
                    AI is analyzing your video...
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    This usually takes 10-30 seconds
                  </p>
                </div>
              </motion.div>
            )}

            {notes && !isLoading && (
              <motion.div
                key="notes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-16"
              >
                <NotesDisplay notes={notes} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;

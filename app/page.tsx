"use client";

import { useState } from "react";
import { PDFUpload } from "@/components/PDFUpload";
import { TaskList } from "@/components/TaskList";
import { Timeline } from "@/components/Timeline";
import { StudyGuide } from "@/components/StudyGuide";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SemesterRoadmap, Task } from "@/lib/types";
import { Loader2, Sparkles } from "lucide-react";

type View = "tasks" | "timeline" | "study-guides";

export default function Home() {
  const [syllabusText, setSyllabusText] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<SemesterRoadmap | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>("tasks");

  const handleTextExtracted = (text: string) => {
    setSyllabusText(text);
    setError(null);
  };

  const handleGenerateRoadmap = async () => {
    if (!syllabusText) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syllabusText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to generate roadmap";
        // Show more helpful message for credit errors
        if (response.status === 402 || errorMessage.includes('credit')) {
          throw new Error(
            "Your Anthropic API account has insufficient credits. " +
            "Please add credits at https://console.anthropic.com/ or use a different API key."
          );
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setRoadmap(data);
      setCurrentView("tasks");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate roadmap"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTaskUpdate = (taskId: string, subtaskId: string, completed: boolean) => {
    if (!roadmap) return;

    setRoadmap({
      ...roadmap,
      tasks: roadmap.tasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            subtasks: task.subtasks.map((subtask) =>
              subtask.id === subtaskId
                ? { ...subtask, completed }
                : subtask
            ),
          };
        }
        return task;
      }),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Academic Command Center</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Transform your syllabus into a prioritized semester roadmap
          </p>
        </div>

        {!roadmap ? (
          <div className="space-y-6">
            <PDFUpload
              onTextExtracted={handleTextExtracted}
              onError={setError}
            />

            {syllabusText && (
              <Card className="glass border-2">
                <CardHeader>
                  <CardTitle>Syllabus Extracted</CardTitle>
                  <CardDescription>
                    Review the extracted text and generate your roadmap
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-h-64 overflow-y-auto p-4 glass rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {syllabusText.substring(0, 1000)}
                      {syllabusText.length > 1000 && "..."}
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateRoadmap}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Roadmap...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Roadmap
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{roadmap.courseName}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {roadmap.tasks.length} tasks • {roadmap.studyGuides.length} study guides
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setRoadmap(null);
                  setSyllabusText(null);
                  setCurrentView("tasks");
                }}
                className="w-full sm:w-auto"
              >
                Start Over
              </Button>
            </div>

            <Nav currentView={currentView} onViewChange={setCurrentView} />

            <div className="mt-6">
              {currentView === "tasks" && (
                <TaskList tasks={roadmap.tasks} onTaskUpdate={handleTaskUpdate} />
              )}
              {currentView === "timeline" && <Timeline events={roadmap.timeline} />}
              {currentView === "study-guides" && (
                <StudyGuide studyGuides={roadmap.studyGuides} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


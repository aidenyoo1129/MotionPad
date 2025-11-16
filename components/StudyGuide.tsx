"use client";

import type { StudyGuide } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen } from "lucide-react";

interface StudyGuideProps {
  studyGuides: StudyGuide[];
}

export function StudyGuide({ studyGuides }: StudyGuideProps) {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          {studyGuides.map((guide, index) => (
            <AccordionItem
              key={index}
              value={`guide-${index}`}
              className="border-b border-border/50 last:border-0"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{guide.topic}</h3>
                    {guide.relatedTasks.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {guide.relatedTasks.length} related task
                        {guide.relatedTasks.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="pl-11 pr-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {guide.content}
                    </div>
                  </div>
                  {guide.relatedTasks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Related Tasks:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {guide.relatedTasks.map((taskId, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                          >
                            {taskId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}



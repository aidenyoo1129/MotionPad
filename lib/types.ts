export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  subtasks: Subtask[];
  category: 'assignment' | 'exam' | 'reading';
}

export interface StudyGuide {
  topic: string;
  content: string;
  relatedTasks: string[];
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  type: 'assignment' | 'exam' | 'reading' | 'milestone';
  taskId?: string;
}

export interface SemesterRoadmap {
  courseName: string;
  tasks: Task[];
  studyGuides: StudyGuide[];
  timeline: TimelineEvent[];
}





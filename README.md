# Hands-Free

A hands-free digital whiteboard with voice commands and gesture controls, plus an Academic Command Center for transforming syllabi into prioritized semester roadmaps.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Hands-Free Whiteboard
- **Infinite Canvas**: Full-screen whiteboard with pan/zoom capabilities
- **Voice Commands**: Control the whiteboard using natural language commands
  - Create objects: "Create box", "Create sticky note", "Create circle", etc.
  - Manipulate objects: "Delete object", "Duplicate object", "Change color to [color]"
  - Canvas controls: "Zoom in", "Zoom out", "Reset canvas"
- **Hand Gesture Controls**: Use MediaPipe Hands for intuitive interactions
  - Closed fist: Grab and move objects
  - Open hand: Release objects
  - Two open hands: Pan the canvas
- **Visual Feedback**: See your hand position, selected objects, and proximity highlights
- **Object Types**: Boxes, sticky notes, circles, arrows, and text boxes

### Academic Command Center
- **PDF Syllabus Upload**: Drag and drop or browse to upload your course syllabus
- **AI-Powered Analysis**: Claude AI extracts course structure, assignments, exams, and readings
- **Prioritized Task List**: Automatically organized tasks with due dates and priority levels
- **Study Guides**: AI-generated study guides for major topics
- **Timeline View**: Visual timeline of all course milestones
- **Linear-Inspired UI**: Modern, dark-mode interface with glassmorphism effects

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- ShadCN UI
- Anthropic Claude API
- PDF parsing with pdf-parse
- Web Speech API (voice commands)
- MediaPipe Hands (gesture tracking)



# Academic Command Center

Transform your syllabus into a prioritized semester roadmap with AI-powered task breakdowns, study guides, and execution workflows.

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



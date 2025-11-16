import { NextRequest, NextResponse } from 'next/server';
import { generateRoadmap } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const { syllabusText } = await request.json();

    if (!syllabusText || typeof syllabusText !== 'string') {
      return NextResponse.json(
        { error: 'Syllabus text is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const roadmap = await generateRoadmap(syllabusText);

    return NextResponse.json(roadmap);
  } catch (error: any) {
    console.error('Error generating roadmap:', error);
    
    // Check for Anthropic API credit/billing errors
    if (error?.error?.error?.message) {
      const apiError = error.error.error.message;
      if (apiError.includes('credit balance') || apiError.includes('billing')) {
        return NextResponse.json(
          { 
            error: 'Insufficient API credits. Please add credits to your Anthropic account at https://console.anthropic.com/',
            details: apiError
          },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { error: apiError },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error?.message || 'Failed to generate roadmap' },
      { status: 500 }
    );
  }
}


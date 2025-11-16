#!/bin/bash

# Script to push Academic Command Center to GitHub
# Run this after resolving Xcode license: sudo xcodebuild -license

cd /Users/aidenyoo/Hands-Free

# Initialize git if not already done
if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
  git add .
  git commit -m "Initial commit: Academic Command Center MVP"
fi

# Add remote (will fail silently if already exists)
git remote add origin https://github.com/aidenyoo1129/Syllabus-Command-Center.git 2>/dev/null || echo "Remote already exists"

# Rename branch to main
git branch -M main

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin main

echo "Done! Check your repository at: https://github.com/aidenyoo1129/Syllabus-Command-Center"


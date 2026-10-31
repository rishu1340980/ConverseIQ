#!/bin/bash
# ConverseIQ Quick Git Commit & Push Script

cd /home/rishu04/Desktop/ConverseIQ || exit 1

COMMIT_MSG="${1:-update: sync latest ConverseIQ system improvements}"

echo "📂 Current Git status:"
git status -s

echo "➕ Staging all changes..."
git add -A

echo "💾 Committing changes: '$COMMIT_MSG'..."
git commit -m "$COMMIT_MSG" || echo "No new changes to commit."

echo "🚀 Pushing to GitHub (origin main)..."
git push origin main

echo "✅ All changes pushed to GitHub successfully!"

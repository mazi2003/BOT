#!/bin/bash
# Deployment script for both frontend and backend

echo "🚀 Starting deployment..."

# Frontend deployment
echo "📁 Deploying frontend to GitHub Pages..."
git add frontend/
git commit -m "Update frontend"
git push origin main

# Backend deployment
echo "🔄 Deploying backend to Render..."
echo "Go to render.com and click 'Deploy' on your service"

echo "✅ Deployment complete!"

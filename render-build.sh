#!/bin/bash

echo "✅ Installing Chrome for Puppeteer"
npx puppeteer browsers install chrome

echo "📦 Installing Node dependencies"
npm install

echo "🚀 Starting the app"
npm start

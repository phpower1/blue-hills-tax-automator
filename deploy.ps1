# Automated Deployment Script for Blue Hills Tax Automator
# This script automates the deployment of the Tax Agent and Telegram Bot to Google Cloud Run.

$PROJECT_ID = "blue-hills-tax-automator"
$REGION = "us-central1"

# 1. Deploy Tax Automator Agent
Write-Host "🚀 Deploying Tax Automator Agent..." -ForegroundColor Cyan
cd tax_automator
gcloud builds submit --tag gcr.io/$PROJECT_ID/tax-automator-agent .
gcloud run deploy tax-automator-agent `
    --image gcr.io/$PROJECT_ID/tax-automator-agent `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
cd ..

# 2. Deploy Telegram Bot
Write-Host "🚀 Deploying Telegram Bot..." -ForegroundColor Cyan
cd telegram-bot
gcloud builds submit --tag gcr.io/$PROJECT_ID/telegram-bot .
gcloud run deploy telegram-bot `
    --image gcr.io/$PROJECT_ID/telegram-bot `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
cd ..

Write-Host "✅ All services deployed successfully!" -ForegroundColor Green

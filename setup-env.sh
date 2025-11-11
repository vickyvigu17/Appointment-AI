#!/bin/bash

echo "🔧 Setting up .env file for backend..."
echo ""

cd "$(dirname "$0")/backend"

if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi

echo "Please provide the following information:"
echo ""

read -p "Supabase URL: " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_KEY
read -p "OpenAI API Key: " OPENAI_API_KEY

cat > .env << EOF
PORT=3001
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
NODE_ENV=development
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "File location: $(pwd)/.env"
echo ""
echo "⚠️  Remember: Never commit .env to Git!"





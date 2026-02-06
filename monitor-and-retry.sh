#!/bin/bash

OUTPUT_FILE="C:\Users\alber\AppData\Local\Temp\claude\c--Users-alber-OneDrive-Desktop-market-ethereumphunks\tasks\be75f41.output"
RETRY_SCRIPT="c:\Users\alber\OneDrive\Desktop\market\ethereumphunks\retry-failed-indexing.js"

echo "🔍 Monitoring indexing script..."

# Wait for script to complete (look for "Complete" in output)
while ! grep -q "Complete" "$OUTPUT_FILE" 2>/dev/null; do
    sleep 30
done

echo "✅ Main script completed!"
echo "📊 Extracting all failed tokens..."

# Extract all failed token IDs
FAILED_TOKENS=$(grep -oP "Token #\K\d+" "$OUTPUT_FILE" | sort -n | tr '\n' ',' | sed 's/,$//')

if [ -z "$FAILED_TOKENS" ]; then
    echo "🎉 No errors! All tokens indexed successfully!"
    exit 0
fi

echo "⚠️  Found failed tokens: $FAILED_TOKENS"
echo "🔄 Updating retry script..."

# Update the retry script with failed tokens
sed -i "s/const failedTokenIds = \[.*\];/const failedTokenIds = [$FAILED_TOKENS];/" "$RETRY_SCRIPT"

echo "▶️  Running retry script..."
cd "c:\Users\alber\OneDrive\Desktop\market\ethereumphunks"
node retry-failed-indexing.js

echo "✨ All done!"

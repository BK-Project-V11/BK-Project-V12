#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if .env file exists and source it
if [ -f "$DIR/../.env" ]; then
    source "$DIR/../.env"
else
    echo "Error: .env file not found!"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file"
    exit 1
fi

# Run latest migration
echo "Running latest migration..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
     -H "Content-Type: application/json" \
     -d @"$DIR/migrations/20251009_storage_distribution.sql"

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Error running migration"
    exit 1
fi
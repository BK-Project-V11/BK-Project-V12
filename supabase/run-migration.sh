#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if config.toml exists
if [ ! -f "$DIR/config.toml" ]; then
    echo "Error: config.toml not found!"
    exit 1
fi

# Run all SQL files in migrations folder
for sql_file in "$DIR"/migrations/*.sql; do
    if [ -f "$sql_file" ]; then
        echo "Running migration: $sql_file"
        psql -f "$sql_file"
        if [ $? -ne 0 ]; then
            echo "Error running migration: $sql_file"
            exit 1
        fi
    fi
done

echo "All migrations completed successfully!"
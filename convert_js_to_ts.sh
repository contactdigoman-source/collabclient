#!/bin/bash
# Helper script to convert JS files to TypeScript
# This shows what needs to be converted but doesn't actually convert files
# (since we need to add proper TypeScript types)

find src -name "*.js" -type f | while read file; do
  if [[ "$file" == *"/services/"* ]] || [[ "$file" == *"/constants/"* ]] || [[ "$file" == *"/themes/"* ]]; then
    echo "$file -> ${file%.js}.ts"
  else
    echo "$file -> ${file%.js}.tsx"
  fi
done

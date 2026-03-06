#!/bin/bash
# Check for circular dependencies in Next.js/React projects
# Usage: bash check-circular-deps.sh <src-path>

set -e

SRC_PATH="${1:-src}"

echo "=== Circular Dependency Check ==="
echo "Scanning: $SRC_PATH"
echo ""

# Check for complex import chains that might indicate circular deps
echo "--- Potential Circular Import Patterns ---"
echo "Looking for mutual imports between files..."
echo ""

# Build import graph
TEMP_FILE=$(mktemp)

for file in $(find "$SRC_PATH" -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v ".spec\." | grep -v ".test\." | grep -v "node_modules"); do
    FILE_NAME=$(basename "$file" | sed 's/\.[^.]*$//')
    DIR_NAME=$(dirname "$file")

    # Get imported local modules
    IMPORTS=$(grep -oE "from ['\"]\.{0,2}/[^'\"]+['\"]" "$file" 2>/dev/null | sed "s/from ['\"]//g" | sed "s/['\"]//g" || true)

    for imp in $IMPORTS; do
        # Resolve relative import to potential file
        IMP_NAME=$(basename "$imp" | sed 's/\.[^.]*$//')
        echo "$FILE_NAME -> $IMP_NAME" >> "$TEMP_FILE"
    done
done

# Look for A->B and B->A patterns
echo "Checking for mutual dependencies..."
echo ""

if [ -f "$TEMP_FILE" ] && [ -s "$TEMP_FILE" ]; then
    FOUND_CIRCULAR=false
    while IFS= read -r line; do
        FROM=$(echo "$line" | cut -d'>' -f1 | tr -d ' -')
        TO=$(echo "$line" | cut -d'>' -f2 | tr -d ' ')

        # Check if reverse exists
        REVERSE=$(grep "^$TO -> $FROM$" "$TEMP_FILE" 2>/dev/null || true)
        if [ -n "$REVERSE" ]; then
            echo "CIRCULAR: $FROM <-> $TO"
            FOUND_CIRCULAR=true
        fi
    done < "$TEMP_FILE" | sort -u

    if [ "$FOUND_CIRCULAR" = false ]; then
        echo "No obvious circular patterns detected."
    fi
else
    echo "No import patterns to analyze."
fi

rm -f "$TEMP_FILE"
echo ""

# Check for complex re-exports that can cause issues
echo "--- Re-export Analysis (index.ts barrel files) ---"
BARREL_FILES=$(find "$SRC_PATH" -name "index.ts" -o -name "index.tsx" 2>/dev/null | grep -v node_modules || true)
if [ -n "$BARREL_FILES" ]; then
    echo "Barrel files found (potential circular dep sources):"
    for barrel in $BARREL_FILES; do
        EXPORT_COUNT=$(grep -c "export" "$barrel" 2>/dev/null || echo 0)
        if [ "$EXPORT_COUNT" -gt 5 ]; then
            echo "  WARNING: $barrel ($EXPORT_COUNT exports)"
        else
            echo "  $barrel ($EXPORT_COUNT exports)"
        fi
    done
else
    echo "No barrel files found."
fi
echo ""

# Check for components importing from parent directories (potential coupling)
echo "--- Parent Directory Imports (coupling indicator) ---"
PARENT_IMPORTS=$(grep -rn "from ['\"]\.\./" "$SRC_PATH" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".spec\." | grep -v ".test\." | head -10 || true)
if [ -n "$PARENT_IMPORTS" ]; then
    echo "Files with parent directory imports:"
    echo "$PARENT_IMPORTS"
else
    echo "No concerning parent imports found."
fi

echo ""
echo "=== Check Complete ==="
echo ""
echo "Tip: Install madge for comprehensive analysis: npm i -g madge"
echo "     Then run: madge --circular $SRC_PATH"

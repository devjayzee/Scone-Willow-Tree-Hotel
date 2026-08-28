#!/bin/bash
# Analyze Next.js project structure for architectural issues
# Usage: bash analyze-structure.sh <src-path>

set -e

SRC_PATH="${1:-src}"

echo "=== Architecture Structure Analysis ==="
echo "Scanning: $SRC_PATH"
echo ""

# Count files by type
echo "--- File Distribution ---"
echo "Pages:           $(find "$SRC_PATH" -name "page.tsx" -o -name "page.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "Layouts:         $(find "$SRC_PATH" -name "layout.tsx" -o -name "layout.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "API Routes:      $(find "$SRC_PATH/app/api" -name "route.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "Components:      $(find "$SRC_PATH/components" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')"
echo "UI Components:   $(find "$SRC_PATH/components/ui" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')"
echo "Hooks:           $(find "$SRC_PATH" -name "use*.ts" -o -name "use*.tsx" 2>/dev/null | wc -l | tr -d ' ')"
echo "Utilities:       $(find "$SRC_PATH/lib" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "Types:           $(find "$SRC_PATH" -name "*.d.ts" -o -path "*/types/*.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "Tests:           $(find "$SRC_PATH" -name "*.spec.ts" -o -name "*.test.ts" -o -name "*.spec.tsx" -o -name "*.test.tsx" 2>/dev/null | wc -l | tr -d ' ')"
echo ""

# Check for large files (potential god components)
echo "--- Large Files (>300 lines) ---"
find "$SRC_PATH" -name "*.ts" -o -name "*.tsx" 2>/dev/null | while read file; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file" | tr -d ' ')
        if [ "$lines" -gt 300 ]; then
            echo "$lines lines: $file"
        fi
    fi
done | sort -rn | head -10 || echo "No large files found."
echo ""

# Check for files with many imports (high coupling)
echo "--- High Coupling (>10 imports) ---"
for file in $(find "$SRC_PATH" -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v ".spec\." | grep -v ".test\."); do
    if [ -f "$file" ]; then
        IMPORT_COUNT=$(grep -c "^import " "$file" 2>/dev/null | head -1)
        if [ "$IMPORT_COUNT" -gt 10 ]; then
            echo "$IMPORT_COUNT imports: $file"
        fi
    fi
done | sort -rn | head -10 || echo "No highly coupled files found."
echo ""

# Check for client components
echo "--- Client Component Usage ---"
CLIENT_COUNT=$(grep -rlE "['\"]use client['\"]" "$SRC_PATH" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
SERVER_COUNT=$(find "$SRC_PATH" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "Client Components: $CLIENT_COUNT"
echo "Total TSX Files:   $SERVER_COUNT"
if [ "$SERVER_COUNT" -gt 0 ]; then
    RATIO=$((CLIENT_COUNT * 100 / SERVER_COUNT))
    echo "Client Ratio:      ${RATIO}%"
    if [ "$RATIO" -gt 50 ]; then
        echo "WARNING: High client component ratio. Consider if all need 'use client'."
    fi
fi
echo ""

# Check for business logic in API routes
echo "--- API Route Analysis ---"
for route in $(find "$SRC_PATH/app/api" -name "route.ts" 2>/dev/null); do
    ISSUES=""

    # Check for direct Prisma calls
    PRISMA_CALLS=$(grep -c "prisma\." "$route" 2>/dev/null | head -1)
    if [ "$PRISMA_CALLS" -gt 5 ]; then
        ISSUES="$ISSUES [Many DB calls: $PRISMA_CALLS]"
    fi

    # Check for long handlers
    LOC=$(wc -l < "$route" | tr -d ' ')
    if [ "$LOC" -gt 100 ]; then
        ISSUES="$ISSUES [Large file: $LOC lines]"
    fi

    if [ -n "$ISSUES" ]; then
        echo "$(echo $route | sed "s|$SRC_PATH/||"):$ISSUES"
    fi
done
echo ""

# Check for components without proper typing
echo "--- Potential Type Issues ---"
ANY_USAGE=$(grep -rn ": any" "$SRC_PATH" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".d.ts" | wc -l | tr -d ' ')
echo "Files with ':any' type: $ANY_USAGE"
if [ "$ANY_USAGE" -gt 10 ]; then
    echo "WARNING: Consider adding proper types to reduce 'any' usage"
fi
echo ""

# Check component organization
echo "--- Component Organization ---"
COMPONENT_DIRS=$(find "$SRC_PATH/components" -type d -maxdepth 1 -mindepth 1 2>/dev/null || true)
for dir in $COMPONENT_DIRS; do
    DIR_NAME=$(basename "$dir")
    FILE_COUNT=$(find "$dir" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
    echo "$DIR_NAME/: $FILE_COUNT components"
done
echo ""

# Check for proper error handling
echo "--- Error Handling ---"
ERROR_BOUNDARIES=$(find "$SRC_PATH" -name "error.tsx" 2>/dev/null | wc -l | tr -d ' ')
LOADING_STATES=$(find "$SRC_PATH" -name "loading.tsx" 2>/dev/null | wc -l | tr -d ' ')
NOT_FOUND=$(find "$SRC_PATH" -name "not-found.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "error.tsx files:     $ERROR_BOUNDARIES"
echo "loading.tsx files:   $LOADING_STATES"
echo "not-found.tsx files: $NOT_FOUND"
echo ""

# Check for middleware / proxy (Next 16 renamed the file convention;
# accept both to stay compatible with older Next projects).
echo "--- Middleware / Proxy ---"
if [ -f "$SRC_PATH/proxy.ts" ] || [ -f "proxy.ts" ]; then
    echo "Proxy (Next 16+): Present"
elif [ -f "$SRC_PATH/middleware.ts" ] || [ -f "middleware.ts" ]; then
    echo "Middleware (pre-Next-16): Present"
else
    echo "Middleware / Proxy: Not found"
fi
echo ""

# Summary
echo "=== Analysis Complete ==="

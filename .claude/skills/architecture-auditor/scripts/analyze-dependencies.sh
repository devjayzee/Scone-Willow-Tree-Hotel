#!/bin/bash
#
# analyze-dependencies.sh - Advanced dependency analysis with external tools
#
# Usage: bash analyze-dependencies.sh <source-directory>
#
# Features:
# - Detects installed tools (madge, dependency-cruiser, ts-complexity)
# - Runs available tools for enhanced analysis
# - Falls back to basic analysis if tools not installed
# - Generates dependency graphs if graphviz is available
#
# External tools (optional):
#   npm install -g madge dependency-cruiser ts-complexity
#   brew install graphviz  # For visual graphs

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SOURCE_DIR="${1:-.}"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo -e "${RED}Error: Directory '$SOURCE_DIR' not found${NC}"
    exit 1
fi

echo "========================================"
echo "  Dependency Analysis"
echo "========================================"
echo ""
echo "Source directory: $SOURCE_DIR"
echo ""

# Tool detection
echo "Detecting available tools..."
echo ""

MADGE_AVAILABLE=false
DEPCRUISE_AVAILABLE=false
TSCOMPLEXITY_AVAILABLE=false
GRAPHVIZ_AVAILABLE=false
TSC_AVAILABLE=false

if command -v madge &> /dev/null; then
    MADGE_AVAILABLE=true
    echo -e "  ${GREEN}✓${NC} madge $(madge --version 2>/dev/null || echo '')"
else
    echo -e "  ${YELLOW}○${NC} madge (not installed - npm i -g madge)"
fi

if command -v depcruise &> /dev/null; then
    DEPCRUISE_AVAILABLE=true
    echo -e "  ${GREEN}✓${NC} dependency-cruiser $(depcruise --version 2>/dev/null || echo '')"
else
    echo -e "  ${YELLOW}○${NC} dependency-cruiser (not installed - npm i -g dependency-cruiser)"
fi

if command -v ts-complexity &> /dev/null; then
    TSCOMPLEXITY_AVAILABLE=true
    echo -e "  ${GREEN}✓${NC} ts-complexity"
else
    echo -e "  ${YELLOW}○${NC} ts-complexity (not installed - npm i -g ts-complexity)"
fi

if command -v dot &> /dev/null; then
    GRAPHVIZ_AVAILABLE=true
    echo -e "  ${GREEN}✓${NC} graphviz (dot)"
else
    echo -e "  ${YELLOW}○${NC} graphviz (not installed - brew install graphviz)"
fi

# Check the project's own tsc, not whatever "tsc" resolves to on PATH —
# a global install can be a different major version and mis-parse
# modern syntax in node_modules type declarations, reporting phantom
# errors `npm run typecheck` doesn't see.
if [[ -f "node_modules/.bin/tsc" ]]; then
    TSC_AVAILABLE=true
    echo -e "  ${GREEN}✓${NC} typescript compiler"
else
    echo -e "  ${YELLOW}○${NC} typescript compiler (install via npm)"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 1. Circular Dependency Analysis
# ============================================
echo ""
echo -e "${BLUE}1. Circular Dependency Analysis${NC}"
echo ""

CIRCULAR_COUNT=0

if [[ "$MADGE_AVAILABLE" == true ]]; then
    echo "Running madge circular dependency check..."
    echo ""

    # Run madge and capture output
    MADGE_OUTPUT=$(madge --circular "$SOURCE_DIR" 2>/dev/null || true)

    if [[ -z "$MADGE_OUTPUT" || "$MADGE_OUTPUT" == "✔ No circular dependency found!" ]]; then
        echo -e "${GREEN}✓ No circular dependencies detected${NC}"
    else
        echo -e "${RED}Circular dependencies found:${NC}"
        echo ""
        echo "$MADGE_OUTPUT"
        CIRCULAR_COUNT=$(echo "$MADGE_OUTPUT" | grep -c "→" || echo 0)
    fi
else
    echo "Falling back to basic circular dependency detection..."
    echo ""

    # Basic detection using grep for forwardRef (NestJS indicator).
    # `|| true` matches the pattern already used elsewhere in this file
    # for expected-empty results: under pipefail, this pipeline's exit
    # status is 1 whenever the initial grep finds zero matches (the
    # common, healthy case), even though wc/tr afterward succeed —
    # without it, set -e aborts the whole script right here.
    FORWARD_REF_COUNT=$(grep -r "forwardRef" "$SOURCE_DIR" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".spec.ts" | wc -l | tr -d ' ' || true)

    if [[ $FORWARD_REF_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Found $FORWARD_REF_COUNT forwardRef usages (potential circular deps):${NC}"
        grep -rn "forwardRef" "$SOURCE_DIR" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".spec.ts" | head -20
        CIRCULAR_COUNT=$FORWARD_REF_COUNT
    else
        echo -e "${GREEN}✓ No forwardRef usage detected${NC}"
    fi

    echo ""
    echo -e "${CYAN}Tip: Install madge for comprehensive circular dependency detection${NC}"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 2. Dependency Tree Analysis
# ============================================
echo ""
echo -e "${BLUE}2. Dependency Tree Analysis${NC}"
echo ""

if [[ "$MADGE_AVAILABLE" == true ]]; then
    echo "Calculating dependency tree depth..."
    echo ""

    # Get summary stats
    MADGE_SUMMARY=$(madge --summary "$SOURCE_DIR" 2>/dev/null || true)

    if [[ -n "$MADGE_SUMMARY" ]]; then
        echo "$MADGE_SUMMARY"
    fi

    echo ""

    # Find files with most dependencies
    echo "Top 10 files by dependency count:"
    echo ""
    madge --json "$SOURCE_DIR" 2>/dev/null | \
        python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    deps = [(k, len(v)) for k, v in data.items()]
    deps.sort(key=lambda x: -x[1])
    for path, count in deps[:10]:
        if count > 0:
            print(f'  {count:3d} deps: {path}')
except:
    pass
" 2>/dev/null || echo "  (requires python3 for JSON parsing)"

else
    echo "Basic dependency counting..."
    echo ""

    echo "Top 10 files by import count:"
    echo ""

    find "$SOURCE_DIR" -name "*.ts" -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -name "*.spec.ts" \
        ! -name "*.d.ts" \
        -exec sh -c 'echo "$(grep -c "^import" "$1" 2>/dev/null || echo 0) $1"' _ {} \; 2>/dev/null | \
        sort -rn | head -10 | \
        while read count file; do
            relative="${file#$SOURCE_DIR/}"
            echo "  $count deps: $relative"
        done
fi

echo ""
echo "----------------------------------------"

# ============================================
# 3. Dependency Graph Generation
# ============================================
echo ""
echo -e "${BLUE}3. Dependency Graph${NC}"
echo ""

if [[ "$MADGE_AVAILABLE" == true && "$GRAPHVIZ_AVAILABLE" == true ]]; then
    GRAPH_FILE="dependency-graph.svg"
    echo "Generating visual dependency graph..."

    if madge --image "$GRAPH_FILE" "$SOURCE_DIR" 2>/dev/null; then
        echo -e "${GREEN}✓ Graph saved to: $GRAPH_FILE${NC}"
    else
        echo -e "${YELLOW}Could not generate graph (may need tsconfig.json)${NC}"
    fi
elif [[ "$MADGE_AVAILABLE" == true ]]; then
    echo -e "${YELLOW}Graphviz not installed - skipping visual graph${NC}"
    echo "Install with: brew install graphviz"
else
    echo -e "${YELLOW}Madge not installed - skipping graph generation${NC}"
    echo "Install with: npm i -g madge"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 4. Complexity Analysis
# ============================================
echo ""
echo -e "${BLUE}4. Complexity Analysis${NC}"
echo ""

if [[ "$TSCOMPLEXITY_AVAILABLE" == true ]]; then
    echo "Running ts-complexity analysis..."
    echo ""

    # ts-complexity output
    ts-complexity "$SOURCE_DIR" 2>/dev/null | head -30 || echo "  (analysis complete)"
else
    echo "Basic complexity indicators (function length)..."
    echo ""

    # Find potentially complex functions by counting lines between function signatures
    echo "Files with potential complex functions (>50 lines between braces):"
    echo ""

    find "$SOURCE_DIR" -name "*.ts" -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -name "*.spec.ts" \
        ! -name "*.d.ts" \
        -exec sh -c '
            file="$1"
            lines=$(wc -l < "$file" | tr -d " ")
            funcs=$(grep -cE "(function |async |=>\s*\{)" "$file" 2>/dev/null || echo 1)
            if [ "$funcs" -gt 0 ]; then
                avg=$((lines / funcs))
                if [ "$avg" -gt 50 ]; then
                    echo "  $file (avg $avg lines/function)"
                fi
            fi
        ' _ {} \; 2>/dev/null | head -10

    echo ""
    echo -e "${CYAN}Tip: Install ts-complexity for cyclomatic complexity metrics${NC}"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 5. Dependency Rules Validation
# ============================================
echo ""
echo -e "${BLUE}5. Dependency Rules Validation${NC}"
echo ""

if [[ "$DEPCRUISE_AVAILABLE" == true ]]; then
    # Check for dependency-cruiser config
    if [[ -f ".dependency-cruiser.js" || -f ".dependency-cruiser.json" ]]; then
        echo "Running dependency-cruiser validation..."
        echo ""
        depcruise "$SOURCE_DIR" --validate 2>/dev/null || true
    else
        echo "No dependency-cruiser config found."
        echo ""
        echo "Running with default rules..."
        echo ""

        # Run with built-in rules
        depcruise "$SOURCE_DIR" --include-only "^src" --output-type err 2>/dev/null | head -30 || true

        echo ""
        echo -e "${CYAN}Tip: Create .dependency-cruiser.js for custom rules${NC}"
        echo "Run: npx depcruise --init"
    fi
else
    echo -e "${YELLOW}dependency-cruiser not installed - skipping rule validation${NC}"
    echo "Install with: npm i -g dependency-cruiser"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 6. TypeScript Compilation Check
# ============================================
echo ""
echo -e "${BLUE}6. TypeScript Compilation Check${NC}"
echo ""

if [[ "$TSC_AVAILABLE" == true ]]; then
    if [[ -f "tsconfig.json" ]]; then
        echo "Running TypeScript type check..."
        echo ""

        TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)

        if [[ -z "$TSC_OUTPUT" ]]; then
            echo -e "${GREEN}✓ No TypeScript errors${NC}"
        else
            ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS" | head -1)
            echo -e "${RED}TypeScript errors: $ERROR_COUNT${NC}"
            echo ""
            echo "$TSC_OUTPUT" | head -20

            if [[ $ERROR_COUNT -gt 20 ]]; then
                echo "... ($((ERROR_COUNT - 20)) more errors)"
            fi
        fi
    else
        echo -e "${YELLOW}No tsconfig.json found in current directory${NC}"
    fi
else
    echo -e "${YELLOW}TypeScript compiler not available${NC}"
fi

echo ""
echo "========================================"
echo "  Summary"
echo "========================================"
echo ""

# Summary
ISSUES_FOUND=false

if [[ $CIRCULAR_COUNT -gt 0 ]]; then
    echo -e "${RED}• Circular dependencies: $CIRCULAR_COUNT${NC}"
    ISSUES_FOUND=true
fi

if [[ "$ISSUES_FOUND" == false ]]; then
    echo -e "${GREEN}✓ No critical dependency issues detected${NC}"
fi

echo ""

# Recommendations
echo "Recommendations:"
echo ""

if [[ "$MADGE_AVAILABLE" == false ]]; then
    echo "  • Install madge for better circular dependency detection:"
    echo "    npm install -g madge"
fi

if [[ "$DEPCRUISE_AVAILABLE" == false ]]; then
    echo "  • Install dependency-cruiser for architecture rule enforcement:"
    echo "    npm install -g dependency-cruiser"
fi

if [[ "$GRAPHVIZ_AVAILABLE" == false && "$MADGE_AVAILABLE" == true ]]; then
    echo "  • Install graphviz for visual dependency graphs:"
    echo "    brew install graphviz"
fi

echo ""
echo "========================================"

exit 0

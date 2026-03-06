#!/bin/bash
#
# analyze-git-history.sh - Detect architectural drift through git history analysis
#
# Usage: bash analyze-git-history.sh <source-directory> [days]
#
# Features:
# - Change hotspots (most frequently modified files)
# - Co-change analysis (files that change together)
# - Complexity growth detection (files growing in size)
# - Module stability ranking
# - New/removed component tracking
#
# Default: Analyzes last 90 days of history

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SOURCE_DIR="${1:-.}"
DAYS="${2:-90}"

# Verify we're in a git repository
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    echo -e "${RED}Error: Not a git repository${NC}"
    exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo -e "${RED}Error: Directory '$SOURCE_DIR' not found${NC}"
    exit 1
fi

SINCE_DATE=$(date -v-${DAYS}d +%Y-%m-%d 2>/dev/null || date -d "$DAYS days ago" +%Y-%m-%d 2>/dev/null || echo "")
if [[ -z "$SINCE_DATE" ]]; then
    # Fallback for systems without date -v or -d
    SINCE_DATE="$DAYS days ago"
fi

echo "========================================"
echo "  Git History Analysis"
echo "========================================"
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Analysis period:  Last $DAYS days"
echo "Since:            $SINCE_DATE"
echo ""
echo "----------------------------------------"

# ============================================
# 1. Change Hotspots
# ============================================
echo ""
echo -e "${BLUE}1. Change Hotspots (Most Modified Files)${NC}"
echo ""
echo "Files with frequent changes may indicate:"
echo "  - Active development area"
echo "  - Unstable code requiring frequent fixes"
echo "  - God classes accumulating responsibilities"
echo ""

echo "Top 15 most modified files:"
echo ""

git log --since="$DAYS days ago" --name-only --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$|\.js$|\.jsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    sort | uniq -c | sort -rn | head -15 | \
    while read count file; do
        if [[ $count -gt 20 ]]; then
            echo -e "  ${RED}$count${NC} changes: $file"
        elif [[ $count -gt 10 ]]; then
            echo -e "  ${YELLOW}$count${NC} changes: $file"
        else
            echo "  $count changes: $file"
        fi
    done

echo ""
echo "----------------------------------------"

# ============================================
# 2. Churn Analysis (Lines Changed)
# ============================================
echo ""
echo -e "${BLUE}2. Code Churn (Lines Added + Deleted)${NC}"
echo ""
echo "High churn indicates volatility - prioritize for refactoring if also complex."
echo ""

echo "Top 15 files by total churn:"
echo ""

git log --since="$DAYS days ago" --numstat --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$|\.js$|\.jsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    awk '{ added[$3]+=$1; deleted[$3]+=$2 } END { for (f in added) print added[f]+deleted[f], added[f], deleted[f], f }' | \
    sort -rn | head -15 | \
    while read total added deleted file; do
        if [[ $total -gt 500 ]]; then
            echo -e "  ${RED}$total${NC} lines churned (+$added/-$deleted): $file"
        elif [[ $total -gt 200 ]]; then
            echo -e "  ${YELLOW}$total${NC} lines churned (+$added/-$deleted): $file"
        else
            echo "  $total lines churned (+$added/-$deleted): $file"
        fi
    done

echo ""
echo "----------------------------------------"

# ============================================
# 3. Co-Change Analysis
# ============================================
echo ""
echo -e "${BLUE}3. Co-Change Analysis (Files Changed Together)${NC}"
echo ""
echo "Files frequently modified together may indicate:"
echo "  - Hidden coupling not visible in imports"
echo "  - Missing abstraction"
echo "  - Shotgun surgery code smell"
echo ""

# Get commits that touched multiple files
echo "Analyzing commit patterns..."
echo ""

# Create temp file for analysis
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

git log --since="$DAYS days ago" --name-only --pretty=format:"COMMIT" -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$|COMMIT" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" > "$TEMP_FILE"

# Find file pairs that change together
echo "Top file pairs that change together:"
echo ""

awk '
    /^COMMIT/ {
        if (length(files) > 1) {
            n = split(files, arr, " ")
            for (i = 1; i < n; i++) {
                for (j = i + 1; j <= n; j++) {
                    if (arr[i] < arr[j]) {
                        pairs[arr[i] " <-> " arr[j]]++
                    } else {
                        pairs[arr[j] " <-> " arr[i]]++
                    }
                }
            }
        }
        files = ""
        next
    }
    { files = files " " $0 }
    END {
        for (pair in pairs) {
            if (pairs[pair] >= 3) {
                print pairs[pair], pair
            }
        }
    }
' "$TEMP_FILE" | sort -rn | head -10 | \
    while read count pair; do
        if [[ $count -gt 10 ]]; then
            echo -e "  ${RED}$count${NC} times: $pair"
        elif [[ $count -gt 5 ]]; then
            echo -e "  ${YELLOW}$count${NC} times: $pair"
        else
            echo "  $count times: $pair"
        fi
    done

echo ""
echo "----------------------------------------"

# ============================================
# 4. Module Stability
# ============================================
echo ""
echo -e "${BLUE}4. Module Stability Ranking${NC}"
echo ""
echo "Modules ranked by change frequency (lower = more stable):"
echo ""

git log --since="$DAYS days ago" --name-only --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    sed 's|/[^/]*$||' | \
    sort | uniq -c | sort -rn | head -15 | \
    while read count module; do
        # Extract just the module name (first directory after src/)
        module_name=$(echo "$module" | sed "s|^$SOURCE_DIR/||" | cut -d'/' -f1)
        if [[ $count -gt 50 ]]; then
            stability="Volatile"
            color=$RED
        elif [[ $count -gt 20 ]]; then
            stability="Active"
            color=$YELLOW
        else
            stability="Stable"
            color=$GREEN
        fi
        echo -e "  ${color}$stability${NC} ($count changes): $module_name"
    done

echo ""
echo "----------------------------------------"

# ============================================
# 5. Growth Detection
# ============================================
echo ""
echo -e "${BLUE}5. File Growth Detection${NC}"
echo ""
echo "Files that have grown significantly may be accumulating responsibilities."
echo ""

echo "Files with net positive growth:"
echo ""

git log --since="$DAYS days ago" --numstat --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    awk '{ added[$3]+=$1; deleted[$3]+=$2 } END { for (f in added) { net=added[f]-deleted[f]; if (net > 50) print net, f } }' | \
    sort -rn | head -10 | \
    while read net file; do
        if [[ $net -gt 200 ]]; then
            echo -e "  ${RED}+$net${NC} lines: $file"
        elif [[ $net -gt 100 ]]; then
            echo -e "  ${YELLOW}+$net${NC} lines: $file"
        else
            echo "  +$net lines: $file"
        fi
    done

echo ""
echo "----------------------------------------"

# ============================================
# 6. New and Removed Files
# ============================================
echo ""
echo -e "${BLUE}6. New and Removed Components${NC}"
echo ""

echo "Recently added files:"
git log --since="$DAYS days ago" --diff-filter=A --name-only --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    sort -u | head -10 | \
    while read file; do
        echo "  + $file"
    done

echo ""
echo "Recently removed files:"
git log --since="$DAYS days ago" --diff-filter=D --name-only --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    sort -u | head -10 | \
    while read file; do
        echo "  - $file"
    done

echo ""
echo "----------------------------------------"

# ============================================
# 7. Author Distribution
# ============================================
echo ""
echo -e "${BLUE}7. Contributor Distribution${NC}"
echo ""
echo "Understanding who works on what helps identify knowledge silos."
echo ""

echo "Top contributors in this period:"
git shortlog -sn --since="$DAYS days ago" -- "$SOURCE_DIR" 2>/dev/null | head -10 | \
    while read count author; do
        echo "  $count commits: $author"
    done

echo ""
echo "========================================"
echo "  Summary & Recommendations"
echo "========================================"
echo ""

# Count hotspots
HOTSPOT_COUNT=$(git log --since="$DAYS days ago" --name-only --pretty=format: -- "$SOURCE_DIR" 2>/dev/null | \
    grep -E "\.ts$|\.tsx$" | \
    grep -v "\.spec\.\|\.test\.\|\.d\.ts" | \
    sort | uniq -c | sort -rn | \
    awk '$1 > 10 { count++ } END { print count+0 }')

echo "Hotspot files (>10 changes): $HOTSPOT_COUNT"

if [[ $HOTSPOT_COUNT -gt 5 ]]; then
    echo ""
    echo -e "${YELLOW}Recommendations:${NC}"
    echo "  1. Review hotspot files for complexity - high churn + high complexity = refactor priority"
    echo "  2. Check co-change pairs for hidden coupling"
    echo "  3. Consider splitting files with >200 lines of net growth"
    echo "  4. Verify volatile modules have good test coverage"
fi

echo ""
echo "========================================"

exit 0

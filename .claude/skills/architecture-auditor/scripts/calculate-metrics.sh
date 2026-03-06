#!/bin/bash
#
# calculate-metrics.sh - Calculate architectural coupling and complexity metrics
#
# Usage: bash calculate-metrics.sh <source-directory>
#
# Calculates:
# - Afferent Coupling (Ca) - Fan-in: who depends on this file
# - Efferent Coupling (Ce) - Fan-out: what this file depends on
# - Instability Index (I) = Ce / (Ca + Ce)
# - File LOC
# - Function count
#
# Thresholds (from architecture-metrics.md):
# - Ce (Fan-out): Warning >8, Critical >12
# - Ca (Fan-in): Warning >15, Critical >20
# - File LOC: Warning >300, Critical >500
# - Instability violations flagged

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Thresholds
CE_WARNING=8
CE_CRITICAL=12
CA_WARNING=15
CA_CRITICAL=20
LOC_WARNING=300
LOC_CRITICAL=500

# Counters
CRITICAL_COUNT=0
WARNING_COUNT=0
FILES_ANALYZED=0

SOURCE_DIR="${1:-.}"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo -e "${RED}Error: Directory '$SOURCE_DIR' not found${NC}"
    exit 1
fi

echo "========================================"
echo "  Architecture Metrics Calculator"
echo "========================================"
echo ""
echo "Source directory: $SOURCE_DIR"
echo "Thresholds:"
echo "  Fan-out (Ce): Warning >$CE_WARNING, Critical >$CE_CRITICAL"
echo "  Fan-in (Ca):  Warning >$CA_WARNING, Critical >$CA_CRITICAL"
echo "  File LOC:     Warning >$LOC_WARNING, Critical >$LOC_CRITICAL"
echo ""
echo "----------------------------------------"
echo ""

# Function to count imports (Ce - Efferent Coupling)
count_imports() {
    local file="$1"
    local count
    # Count import statements (handles multi-line imports by counting 'from' keywords)
    count=$(grep -c "^import\|from ['\"]" "$file" 2>/dev/null) || count=0
    echo "$count"
}

# Function to count files that import this file (Ca - Afferent Coupling)
count_dependents() {
    local file="$1"
    local basename=$(basename "$file" .ts)
    local dirname=$(dirname "$file")

    # Create search patterns for how this file might be imported
    # Handles: './filename', '../dir/filename', '@/path/filename'
    local relative_path="${file#$SOURCE_DIR/}"
    relative_path="${relative_path%.ts}"

    # Count files that import this module
    local count=0
    count=$(grep -rl "from.*['\"].*${basename}['\"]" "$SOURCE_DIR" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

    # Subtract 1 if the file imports itself (shouldn't happen but safety check)
    echo "$count"
}

# Function to count lines of code (excluding blanks and comments)
count_loc() {
    local file="$1"
    local count
    # Count non-blank, non-comment lines
    count=$(grep -v '^\s*$' "$file" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*' | grep -v '^\s*/\*' | wc -l | tr -d ' ') || count=0
    echo "$count"
}

# Function to count functions/methods
count_functions() {
    local file="$1"
    # Count function declarations, arrow functions assigned to const, and class methods
    local count
    count=$(grep -cE "(function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(|async\s+\w+\s*\(|\s+\w+\s*\([^)]*\)\s*(\{|:))" "$file" 2>/dev/null) || count=0
    echo "$count"
}

# Function to determine severity
get_severity() {
    local value=$1
    local warning=$2
    local critical=$3

    if [[ $value -gt $critical ]]; then
        echo "CRITICAL"
    elif [[ $value -gt $warning ]]; then
        echo "WARNING"
    else
        echo "OK"
    fi
}

# Function to print colored severity
print_severity() {
    local severity="$1"
    case "$severity" in
        "CRITICAL")
            echo -e "${RED}$severity${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}$severity${NC}"
            ;;
        *)
            echo -e "${GREEN}$severity${NC}"
            ;;
    esac
}

echo "Analyzing files..."
echo ""

# Arrays to store results for summary
declare -a HIGH_CE_FILES=()
declare -a HIGH_CA_FILES=()
declare -a HIGH_LOC_FILES=()
declare -a INSTABILITY_DATA=()

# Find all TypeScript files (excluding node_modules, dist, test files)
while IFS= read -r -d '' file; do
    ((FILES_ANALYZED++))

    # Calculate metrics
    ce=$(count_imports "$file")
    ca=$(count_dependents "$file")
    loc=$(count_loc "$file")
    funcs=$(count_functions "$file")

    # Calculate Instability Index
    if [[ $((ca + ce)) -gt 0 ]]; then
        # Bash doesn't do floating point, so multiply by 100 for percentage
        instability=$((ce * 100 / (ca + ce)))
    else
        instability=0
    fi

    # Determine severities
    ce_severity=$(get_severity $ce $CE_WARNING $CE_CRITICAL)
    ca_severity=$(get_severity $ca $CA_WARNING $CA_CRITICAL)
    loc_severity=$(get_severity $loc $LOC_WARNING $LOC_CRITICAL)

    # Track issues
    has_issue=false

    if [[ "$ce_severity" == "CRITICAL" ]]; then
        ((CRITICAL_COUNT++))
        HIGH_CE_FILES+=("$file|$ce")
        has_issue=true
    elif [[ "$ce_severity" == "WARNING" ]]; then
        ((WARNING_COUNT++))
        HIGH_CE_FILES+=("$file|$ce")
        has_issue=true
    fi

    if [[ "$ca_severity" == "CRITICAL" ]]; then
        ((CRITICAL_COUNT++))
        HIGH_CA_FILES+=("$file|$ca")
        has_issue=true
    elif [[ "$ca_severity" == "WARNING" ]]; then
        ((WARNING_COUNT++))
        HIGH_CA_FILES+=("$file|$ca")
        has_issue=true
    fi

    if [[ "$loc_severity" == "CRITICAL" ]]; then
        ((CRITICAL_COUNT++))
        HIGH_LOC_FILES+=("$file|$loc")
        has_issue=true
    elif [[ "$loc_severity" == "WARNING" ]]; then
        ((WARNING_COUNT++))
        HIGH_LOC_FILES+=("$file|$loc")
        has_issue=true
    fi

    # Store instability data for later analysis
    INSTABILITY_DATA+=("$file|$instability|$ca|$ce")

    # Only print files with issues
    if [[ "$has_issue" == true ]]; then
        relative_path="${file#$SOURCE_DIR/}"
        echo -e "${BLUE}$relative_path${NC}"
        echo "  Ce (Fan-out): $ce $(print_severity $ce_severity)"
        echo "  Ca (Fan-in):  $ca $(print_severity $ca_severity)"
        echo "  LOC:          $loc $(print_severity $loc_severity)"
        echo "  Instability:  0.$instability ($([ $instability -lt 30 ] && echo "Stable" || ([ $instability -lt 70 ] && echo "Balanced" || echo "Unstable")))"
        echo "  Functions:    $funcs"
        echo ""
    fi

done < <(find "$SOURCE_DIR" -name "*.ts" -type f \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/.git/*" \
    ! -name "*.spec.ts" \
    ! -name "*.test.ts" \
    ! -name "*.d.ts" \
    -print0 2>/dev/null)

echo "========================================"
echo "  Summary"
echo "========================================"
echo ""
echo "Files analyzed: $FILES_ANALYZED"
echo -e "Critical issues: ${RED}$CRITICAL_COUNT${NC}"
echo -e "Warnings: ${YELLOW}$WARNING_COUNT${NC}"
echo ""

# High Fan-out summary
if [[ ${#HIGH_CE_FILES[@]} -gt 0 ]]; then
    echo -e "${YELLOW}High Fan-out (Ce > $CE_WARNING) - Review coupling:${NC}"
    for entry in "${HIGH_CE_FILES[@]}"; do
        file="${entry%|*}"
        value="${entry#*|}"
        relative_path="${file#$SOURCE_DIR/}"
        severity=$(get_severity $value $CE_WARNING $CE_CRITICAL)
        echo "  $(print_severity $severity) $relative_path (Ce=$value)"
    done
    echo ""
fi

# High Fan-in summary
if [[ ${#HIGH_CA_FILES[@]} -gt 0 ]]; then
    echo -e "${YELLOW}High Fan-in (Ca > $CA_WARNING) - Ensure stability:${NC}"
    for entry in "${HIGH_CA_FILES[@]}"; do
        file="${entry%|*}"
        value="${entry#*|}"
        relative_path="${file#$SOURCE_DIR/}"
        severity=$(get_severity $value $CA_WARNING $CA_CRITICAL)
        echo "  $(print_severity $severity) $relative_path (Ca=$value)"
    done
    echo ""
fi

# High LOC summary
if [[ ${#HIGH_LOC_FILES[@]} -gt 0 ]]; then
    echo -e "${YELLOW}Large Files (LOC > $LOC_WARNING) - Consider splitting:${NC}"
    for entry in "${HIGH_LOC_FILES[@]}"; do
        file="${entry%|*}"
        value="${entry#*|}"
        relative_path="${file#$SOURCE_DIR/}"
        severity=$(get_severity $value $LOC_WARNING $LOC_CRITICAL)
        echo "  $(print_severity $severity) $relative_path (LOC=$value)"
    done
    echo ""
fi

# Module-level aggregation (group by directory)
echo "----------------------------------------"
echo ""
echo -e "${BLUE}Module-level Metrics (by directory):${NC}"
echo ""

declare -A MODULE_CE
declare -A MODULE_CA
declare -A MODULE_FILES

for entry in "${INSTABILITY_DATA[@]}"; do
    file="${entry%%|*}"
    rest="${entry#*|}"
    instability="${rest%%|*}"
    rest="${rest#*|}"
    ca="${rest%%|*}"
    ce="${rest#*|}"

    # Get module (parent directory)
    module=$(dirname "$file")
    module="${module#$SOURCE_DIR/}"
    # Get top-level module only
    module="${module%%/*}"

    if [[ -n "$module" ]]; then
        MODULE_CE[$module]=$((${MODULE_CE[$module]:-0} + ce))
        MODULE_CA[$module]=$((${MODULE_CA[$module]:-0} + ca))
        MODULE_FILES[$module]=$((${MODULE_FILES[$module]:-0} + 1))
    fi
done

# Print module summary
printf "%-20s %8s %8s %8s %12s\n" "Module" "Files" "Avg Ce" "Avg Ca" "Instability"
printf "%-20s %8s %8s %8s %12s\n" "------" "-----" "------" "------" "-----------"

for module in "${!MODULE_FILES[@]}"; do
    files=${MODULE_FILES[$module]}
    total_ce=${MODULE_CE[$module]}
    total_ca=${MODULE_CA[$module]}

    avg_ce=$((total_ce / files))
    avg_ca=$((total_ca / files))

    if [[ $((total_ca + total_ce)) -gt 0 ]]; then
        mod_instability=$((total_ce * 100 / (total_ca + total_ce)))
    else
        mod_instability=0
    fi

    printf "%-20s %8d %8d %8d %11d%%\n" "$module" "$files" "$avg_ce" "$avg_ca" "$mod_instability"
done

echo ""
echo "========================================"
echo ""

# Exit with appropriate code
if [[ $CRITICAL_COUNT -gt 0 ]]; then
    echo -e "${RED}Critical issues found. Review required.${NC}"
    exit 1
elif [[ $WARNING_COUNT -gt 0 ]]; then
    echo -e "${YELLOW}Warnings found. Consider reviewing.${NC}"
    exit 0
else
    echo -e "${GREEN}No significant coupling issues detected.${NC}"
    exit 0
fi

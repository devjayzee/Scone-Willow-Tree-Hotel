#!/bin/bash
#
# validate-adrs.sh - Validate Architecture Decision Records
#
# Usage: bash validate-adrs.sh <adr-directory>
#
# Features:
# - ADR inventory and status summary
# - Check for superseded ADRs
# - Validate ADR format (required sections)
# - Check if deprecated patterns still exist in code
#
# Expected ADR format (based on Michael Nygard template):
# - Title (# ADR NNNN: Title)
# - Status (Proposed, Accepted, Deprecated, Superseded)
# - Context
# - Decision
# - Consequences

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ADR_DIR="${1:-docs/adr}"

echo "========================================"
echo "  ADR Validation"
echo "========================================"
echo ""
echo "ADR Directory: $ADR_DIR"
echo ""

if [[ ! -d "$ADR_DIR" ]]; then
    echo -e "${YELLOW}Warning: ADR directory '$ADR_DIR' not found${NC}"
    echo ""
    echo "Architecture Decision Records (ADRs) help document important decisions."
    echo ""
    echo "To get started with ADRs:"
    echo "  1. Create the directory: mkdir -p $ADR_DIR"
    echo "  2. Create your first ADR using the template below"
    echo ""
    echo "Suggested ADR template (docs/adr/0001-example.md):"
    echo ""
    cat << 'EOF'
# ADR 0001: [Decision Title]

## Status
Accepted

## Context
[What is the issue that we're seeing that is motivating this decision?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences
[What becomes easier or more difficult to do because of this change?]

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Tradeoff 1]
- [Tradeoff 2]

### Risks
- [Risk 1]
EOF
    echo ""
    echo "========================================"
    exit 0
fi

echo "----------------------------------------"

# ============================================
# 1. ADR Inventory
# ============================================
echo ""
echo -e "${BLUE}1. ADR Inventory${NC}"
echo ""

# Find all ADR files
ADR_FILES=$(find "$ADR_DIR" -name "*.md" -type f 2>/dev/null | sort)
ADR_COUNT=$(echo "$ADR_FILES" | grep -c "." || echo 0)

if [[ $ADR_COUNT -eq 0 ]]; then
    echo -e "${YELLOW}No ADR files found in $ADR_DIR${NC}"
    echo ""
    echo "Create ADRs as markdown files (e.g., 0001-use-nestjs.md)"
    exit 0
fi

echo "Found $ADR_COUNT ADR(s):"
echo ""

# Counters for status
ACCEPTED=0
PROPOSED=0
DEPRECATED=0
SUPERSEDED=0
UNKNOWN=0

for adr in $ADR_FILES; do
    filename=$(basename "$adr")

    # Extract title (first # heading)
    title=$(grep -m1 "^#" "$adr" 2>/dev/null | sed 's/^#\+\s*//' || echo "Untitled")

    # Extract status
    status=$(grep -i "^##\s*status" -A1 "$adr" 2>/dev/null | tail -1 | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]' || echo "unknown")

    # Determine status color and count
    case "$status" in
        *accepted*|*active*)
            status_display="${GREEN}Accepted${NC}"
            ((ACCEPTED++))
            ;;
        *proposed*|*draft*)
            status_display="${CYAN}Proposed${NC}"
            ((PROPOSED++))
            ;;
        *deprecated*)
            status_display="${YELLOW}Deprecated${NC}"
            ((DEPRECATED++))
            ;;
        *superseded*)
            status_display="${YELLOW}Superseded${NC}"
            ((SUPERSEDED++))
            ;;
        *)
            status_display="${RED}Unknown${NC}"
            ((UNKNOWN++))
            ;;
    esac

    echo -e "  [$status_display] $filename"
    echo "      $title"
done

echo ""
echo "Status summary:"
echo -e "  Accepted:   ${GREEN}$ACCEPTED${NC}"
echo -e "  Proposed:   ${CYAN}$PROPOSED${NC}"
echo -e "  Deprecated: ${YELLOW}$DEPRECATED${NC}"
echo -e "  Superseded: ${YELLOW}$SUPERSEDED${NC}"
if [[ $UNKNOWN -gt 0 ]]; then
    echo -e "  Unknown:    ${RED}$UNKNOWN${NC}"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 2. Format Validation
# ============================================
echo ""
echo -e "${BLUE}2. Format Validation${NC}"
echo ""

REQUIRED_SECTIONS=("Status" "Context" "Decision" "Consequences")
INVALID_ADRS=0

for adr in $ADR_FILES; do
    filename=$(basename "$adr")
    missing_sections=()

    for section in "${REQUIRED_SECTIONS[@]}"; do
        if ! grep -qi "^##\s*$section" "$adr" 2>/dev/null; then
            missing_sections+=("$section")
        fi
    done

    if [[ ${#missing_sections[@]} -gt 0 ]]; then
        ((INVALID_ADRS++))
        echo -e "${YELLOW}$filename${NC} - Missing sections:"
        for section in "${missing_sections[@]}"; do
            echo "    - $section"
        done
    fi
done

if [[ $INVALID_ADRS -eq 0 ]]; then
    echo -e "${GREEN}✓ All ADRs have required sections${NC}"
else
    echo ""
    echo -e "${YELLOW}$INVALID_ADRS ADR(s) have missing sections${NC}"
fi

echo ""
echo "Required sections: ${REQUIRED_SECTIONS[*]}"

echo ""
echo "----------------------------------------"

# ============================================
# 3. Superseded ADR Check
# ============================================
echo ""
echo -e "${BLUE}3. Superseded ADR Analysis${NC}"
echo ""

SUPERSEDED_WITHOUT_LINK=0

for adr in $ADR_FILES; do
    filename=$(basename "$adr")
    status=$(grep -i "^##\s*status" -A1 "$adr" 2>/dev/null | tail -1 | tr '[:lower:]' '[:upper:]' || echo "")

    if [[ "$status" == *"SUPERSEDED"* ]]; then
        # Check if there's a link to the superseding ADR
        if ! grep -qi "superseded.*by\|replaced.*by\|see.*adr\|see.*0[0-9]" "$adr" 2>/dev/null; then
            ((SUPERSEDED_WITHOUT_LINK++))
            echo -e "${YELLOW}$filename${NC} - Superseded but no link to replacement"
        fi
    fi
done

if [[ $SUPERSEDED_WITHOUT_LINK -eq 0 && $SUPERSEDED -gt 0 ]]; then
    echo -e "${GREEN}✓ All superseded ADRs link to their replacements${NC}"
elif [[ $SUPERSEDED -eq 0 ]]; then
    echo "No superseded ADRs found"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 4. Deprecated Pattern Check
# ============================================
echo ""
echo -e "${BLUE}4. Deprecated Pattern Detection${NC}"
echo ""
echo "Checking if deprecated patterns are still in use..."
echo ""

DEPRECATED_IN_USE=0

for adr in $ADR_FILES; do
    filename=$(basename "$adr")
    status=$(grep -i "^##\s*status" -A1 "$adr" 2>/dev/null | tail -1 | tr '[:lower:]' '[:upper:]' || echo "")

    if [[ "$status" == *"DEPRECATED"* ]]; then
        # Try to extract keywords from the decision section
        decision=$(awk '/^##\s*[Dd]ecision/,/^##/' "$adr" 2>/dev/null | grep -v "^##" || echo "")

        # Look for code patterns mentioned in the ADR
        # Common patterns: class names, function names, imports
        patterns=$(echo "$decision" | grep -oE '\`[A-Za-z]+\`' | tr -d '`' | sort -u || echo "")

        if [[ -n "$patterns" ]]; then
            echo -e "${CYAN}Checking deprecated ADR: $filename${NC}"

            for pattern in $patterns; do
                # Skip common words
                if [[ ${#pattern} -lt 4 || "$pattern" =~ ^(true|false|null|this|that|with|from|when)$ ]]; then
                    continue
                fi

                # Search for pattern in source code
                matches=$(grep -rl "$pattern" src/ --include="*.ts" 2>/dev/null | grep -v "\.spec\.ts\|\.test\.ts" | head -3 || echo "")

                if [[ -n "$matches" ]]; then
                    ((DEPRECATED_IN_USE++))
                    echo -e "  ${YELLOW}Pattern '$pattern' found in:${NC}"
                    echo "$matches" | while read match; do
                        echo "    - $match"
                    done
                fi
            done
        fi
    fi
done

if [[ $DEPRECATED_IN_USE -eq 0 && $DEPRECATED -gt 0 ]]; then
    echo -e "${GREEN}✓ No deprecated patterns detected in source code${NC}"
elif [[ $DEPRECATED -eq 0 ]]; then
    echo "No deprecated ADRs to check"
fi

echo ""
echo "----------------------------------------"

# ============================================
# 5. ADR Coverage Check
# ============================================
echo ""
echo -e "${BLUE}5. ADR Coverage Recommendations${NC}"
echo ""

echo "Common architectural decisions that should have ADRs:"
echo ""

# Check for common patterns that should have ADRs
declare -A COMMON_DECISIONS=(
    ["Authentication"]="auth|jwt|passport|session"
    ["Database"]="prisma|typeorm|sequelize|mongoose"
    ["API Style"]="rest|graphql|grpc"
    ["State Management"]="redux|zustand|mobx|context"
    ["Testing Strategy"]="jest|vitest|cypress|playwright"
    ["Deployment"]="docker|kubernetes|serverless"
    ["Caching"]="redis|memcached|cache"
    ["Message Queue"]="bullmq|rabbitmq|kafka|sqs"
)

MISSING_COVERAGE=0

for decision in "${!COMMON_DECISIONS[@]}"; do
    pattern="${COMMON_DECISIONS[$decision]}"

    # Check if this pattern exists in package.json or source
    if grep -qiE "$pattern" package.json 2>/dev/null || \
       find src/ -name "*.ts" -exec grep -l -iE "$pattern" {} \; 2>/dev/null | head -1 | grep -q .; then

        # Check if there's an ADR covering this
        has_adr=false
        for adr in $ADR_FILES; do
            if grep -qiE "$pattern" "$adr" 2>/dev/null; then
                has_adr=true
                break
            fi
        done

        if [[ "$has_adr" == false ]]; then
            ((MISSING_COVERAGE++))
            echo -e "  ${YELLOW}○${NC} $decision - Consider documenting this decision"
        else
            echo -e "  ${GREEN}✓${NC} $decision - Documented"
        fi
    fi
done

if [[ $MISSING_COVERAGE -eq 0 ]]; then
    echo -e "${GREEN}✓ Major architectural decisions appear to be documented${NC}"
fi

echo ""
echo "========================================"
echo "  Summary"
echo "========================================"
echo ""
echo "Total ADRs:           $ADR_COUNT"
echo "Format issues:        $INVALID_ADRS"
echo "Missing supersede links: $SUPERSEDED_WITHOUT_LINK"
echo "Deprecated in use:    $DEPRECATED_IN_USE"
echo ""

TOTAL_ISSUES=$((INVALID_ADRS + SUPERSEDED_WITHOUT_LINK + DEPRECATED_IN_USE))

if [[ $TOTAL_ISSUES -eq 0 ]]; then
    echo -e "${GREEN}✓ ADR validation passed${NC}"
else
    echo -e "${YELLOW}Found $TOTAL_ISSUES issue(s) to address${NC}"
fi

echo ""
echo "========================================"

exit 0

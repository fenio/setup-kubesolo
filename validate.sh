#!/bin/bash
set -e

echo "🔍 Validating Setup KubeSolo Action..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check we're in the right directory
if [ ! -f "action.yml" ]; then
    error "action.yml not found. Run this script from the repository root."
fi

echo "📋 Checking required files..."
required_files=("action.yml" "README.md" "LICENSE")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file is missing"
    fi
done
echo ""

echo "🔍 Validating action.yml syntax..."
if command -v ruby &> /dev/null; then
    if ruby -ryaml -e "YAML.load_file('action.yml')" 2>/dev/null; then
        success "action.yml is valid YAML"
    else
        error "action.yml has YAML syntax errors"
    fi
elif command -v python3 &> /dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('action.yml'))" 2>/dev/null; then
        success "action.yml is valid YAML"
    else
        error "action.yml has YAML syntax errors"
    fi
else
    warning "Ruby/Python not found, skipping YAML validation"
fi
echo ""

echo "🔍 Checking for placeholder text..."
if grep -r "YOUR_USERNAME\|bfenski\|YOUR_ORG" . --exclude-dir=.git --exclude="*.sh" -q 2>/dev/null; then
    warning "Found potential placeholders:"
    grep -r "YOUR_USERNAME\|bfenski\|YOUR_ORG" . --exclude-dir=.git --exclude="*.sh" 2>/dev/null || true
    echo ""
else
    success "No placeholders found"
fi
echo ""

echo "📦 Checking action metadata..."
if grep -q "name: 'Setup KubeSolo'" action.yml; then
    success "Action name is set"
else
    error "Action name not found in action.yml"
fi

if grep -q "author: 'fenio'" action.yml; then
    success "Author is set to 'fenio'"
else
    error "Author not set correctly in action.yml"
fi

if grep -q "description:" action.yml; then
    success "Description is present"
else
    error "Description missing in action.yml"
fi
echo ""

echo "🎨 Checking branding..."
if grep -q "icon:" action.yml && grep -q "color:" action.yml; then
    success "Branding (icon and color) configured"
else
    warning "Branding not configured (optional but recommended)"
fi
echo ""

echo "📥 Checking inputs..."
input_count=$(grep -c "^\s\s[a-z-]*:" action.yml | tail -1)
if [ "$input_count" -gt 0 ]; then
    success "Found inputs defined"
else
    warning "No inputs found"
fi
echo ""

echo "📤 Checking outputs..."
if grep -q "^outputs:" action.yml; then
    success "Outputs section present"
else
    warning "No outputs defined"
fi
echo ""

echo "🔧 Checking composite action structure..."
if grep -q "using: 'composite'" action.yml; then
    success "Composite action configured"
else
    error "Not configured as composite action"
fi

if grep -q "shell: bash" action.yml; then
    success "Bash shell specified"
else
    error "Shell not specified in steps"
fi
echo ""

echo "📝 Checking documentation..."
if grep -q "## Usage" README.md; then
    success "README has Usage section"
else
    warning "README missing Usage section"
fi

if grep -q "## Inputs" README.md; then
    success "README documents inputs"
else
    warning "README missing Inputs documentation"
fi

if grep -q "MIT License" LICENSE; then
    success "MIT License present"
else
    warning "License type unclear"
fi
echo ""

echo "🧪 Checking test workflow..."
if [ -f ".github/workflows/test.yml" ]; then
    success "Test workflow exists"
else
    warning "No test workflow found"
fi
echo ""

echo "═══════════════════════════════════════════"
echo -e "${GREEN}🎉 Validation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. git init && git add . && git commit -m 'Initial commit'"
echo "2. git remote add origin https://github.com/fenio/setup-kubesolo.git"
echo "3. git push -u origin main"
echo "4. Check GitHub Actions tab to see tests run"
echo "5. Test using: uses: fenio/setup-kubesolo@main"
echo ""
echo "See TESTING.md for detailed testing instructions"
echo "See PUBLISHING.md for marketplace publishing steps"
echo "═══════════════════════════════════════════"

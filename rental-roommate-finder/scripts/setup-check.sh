#!/usr/bin/env bash
# =============================================================
# RentMate - Setup Check & Auto-Install Script
# Checks all required tools. If missing -> installs them.
# Supports: Ubuntu/Debian (apt), Amazon Linux/RHEL (yum/dnf), macOS (brew)
#
# Usage:
#   chmod +x scripts/setup-check.sh
#   ./scripts/setup-check.sh
# =============================================================

set -euo pipefail

# ---- Colors for output ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---- Version targets ----
TERRAFORM_VERSION="1.5.7"
KUBECTL_VERSION="v1.29.0"
HELM_VERSION="v3.14.0"
NODE_VERSION="20"

# ---- Counters ----
INSTALLED=0
ALREADY_OK=0
FAILED=0

# =============================================================
# HELPER FUNCTIONS
# =============================================================

print_header() {
  echo ""
  echo -e "${BLUE}${BOLD}=============================================${NC}"
  echo -e "${BLUE}${BOLD}  RentMate - Pre-Flight Setup Check${NC}"
  echo -e "${BLUE}${BOLD}=============================================${NC}"
  echo ""
}

print_section() {
  echo ""
  echo -e "${BOLD}--- $1 ---${NC}"
}

ok() {
  echo -e "  ${GREEN}[OK]${NC}  $1"
  ALREADY_OK=$((ALREADY_OK + 1))
}

installed_msg() {
  echo -e "  ${YELLOW}[INSTALLED]${NC}  $1"
  INSTALLED=$((INSTALLED + 1))
}

fail() {
  echo -e "  ${RED}[FAILED]${NC}  $1"
  FAILED=$((FAILED + 1))
}

info() {
  echo -e "  ${BLUE}[INFO]${NC}  $1"
}

# Detect OS
detect_os() {
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v apt-get &>/dev/null; then
      OS="ubuntu"
    elif command -v dnf &>/dev/null; then
      OS="fedora"
    elif command -v yum &>/dev/null; then
      OS="amazon"
    else
      OS="linux-unknown"
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
  else
    OS="unknown"
  fi
  info "Detected OS: $OS ($OSTYPE)"
}

# =============================================================
# INSTALL FUNCTIONS
# =============================================================

install_awscli() {
  info "Installing AWS CLI v2..."
  if [[ "$OS" == "macos" ]]; then
    curl -s "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "/tmp/AWSCLIV2.pkg"
    sudo installer -pkg /tmp/AWSCLIV2.pkg -target /
    rm /tmp/AWSCLIV2.pkg
  else
    curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
    cd /tmp && unzip -q awscliv2.zip
    sudo /tmp/aws/install --update
    rm -rf /tmp/awscliv2.zip /tmp/aws
  fi
}

install_terraform() {
  info "Installing Terraform ${TERRAFORM_VERSION}..."
  local TF_URL
  if [[ "$OS" == "macos" ]]; then
    TF_URL="https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_amd64.zip"
  else
    TF_URL="https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
  fi
  curl -s -Lo /tmp/terraform.zip "$TF_URL"
  unzip -q /tmp/terraform.zip -d /tmp/terraform_bin
  sudo mv /tmp/terraform_bin/terraform /usr/local/bin/terraform
  sudo chmod +x /usr/local/bin/terraform
  rm -rf /tmp/terraform.zip /tmp/terraform_bin
}

install_kubectl() {
  info "Installing kubectl ${KUBECTL_VERSION}..."
  if [[ "$OS" == "macos" ]]; then
    curl -sLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/darwin/amd64/kubectl"
  else
    curl -sLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
  fi
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl 2>/dev/null || \
    sudo mv kubectl /usr/local/bin/kubectl && sudo chmod +x /usr/local/bin/kubectl
  rm -f kubectl
}

install_docker() {
  info "Installing Docker..."
  if [[ "$OS" == "macos" ]]; then
    echo -e "  ${YELLOW}[MANUAL]${NC}  macOS: Download Docker Desktop from https://www.docker.com/products/docker-desktop"
    return
  elif [[ "$OS" == "ubuntu" ]]; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker "$USER" || true
  elif [[ "$OS" == "amazon" ]] || [[ "$OS" == "fedora" ]]; then
    sudo yum install -y docker
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$USER" || true
  fi
}

install_helm() {
  info "Installing Helm ${HELM_VERSION}..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
}

install_node() {
  info "Installing Node.js v${NODE_VERSION} via nvm..."
  if ! command -v nvm &>/dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  fi
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
  nvm alias default "$NODE_VERSION"
}

install_git() {
  info "Installing git..."
  if [[ "$OS" == "ubuntu" ]]; then
    sudo apt-get update -qq && sudo apt-get install -y -qq git
  elif [[ "$OS" == "amazon" ]] || [[ "$OS" == "fedora" ]]; then
    sudo yum install -y git
  elif [[ "$OS" == "macos" ]]; then
    brew install git
  fi
}

install_unzip() {
  info "Installing unzip (needed for other installs)..."
  if [[ "$OS" == "ubuntu" ]]; then
    sudo apt-get update -qq && sudo apt-get install -y -qq unzip curl
  elif [[ "$OS" == "amazon" ]] || [[ "$OS" == "fedora" ]]; then
    sudo yum install -y unzip curl
  fi
}

# =============================================================
# CHECK FUNCTIONS
# =============================================================

check_and_install() {
  local TOOL=$1
  local CHECK_CMD=$2
  local INSTALL_FN=$3
  local VERSION_CMD=${4:-""}

  if command -v "$CHECK_CMD" &>/dev/null; then
    local VERSION_OUT=""
    if [[ -n "$VERSION_CMD" ]]; then
      VERSION_OUT=$(eval "$VERSION_CMD" 2>/dev/null | head -1) || VERSION_OUT="version unknown"
    fi
    ok "$TOOL is installed ${VERSION_OUT:+(${VERSION_OUT})}"
  else
    info "$TOOL not found. Installing..."
    if $INSTALL_FN 2>&1; then
      installed_msg "$TOOL installed successfully"
    else
      fail "$TOOL installation failed. Please install manually."
    fi
  fi
}

# =============================================================
# MAIN - RUN ALL CHECKS
# =============================================================

print_header
detect_os

# Ensure unzip + curl are available first (needed by install functions)
print_section "Bootstrap Dependencies"
if ! command -v unzip &>/dev/null || ! command -v curl &>/dev/null; then
  install_unzip
  ok "unzip + curl ready"
else
  ok "unzip and curl already available"
fi

print_section "1. Git"
check_and_install "Git" "git" install_git "git --version"

print_section "2. AWS CLI"
check_and_install "AWS CLI" "aws" install_awscli "aws --version"

print_section "3. Terraform"
check_and_install "Terraform" "terraform" install_terraform "terraform version | head -1"

print_section "4. kubectl"
check_and_install "kubectl" "kubectl" install_kubectl "kubectl version --client --short 2>/dev/null || kubectl version --client"

print_section "5. Docker"
check_and_install "Docker" "docker" install_docker "docker --version"

print_section "6. Helm"
check_and_install "Helm" "helm" install_helm "helm version --short"

print_section "7. Node.js"
check_and_install "Node.js" "node" install_node "node --version"

print_section "8. npm"
if command -v npm &>/dev/null; then
  ok "npm is installed ($(npm --version))"
else
  info "npm not found - it comes with Node.js, re-check after Node install"
fi

print_section "9. AWS CLI Configuration Check"
if aws sts get-caller-identity &>/dev/null; then
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
  ok "AWS CLI is configured and authenticated (Account: ${ACCOUNT})"
else
  echo -e "  ${YELLOW}[WARN]${NC}  AWS CLI is not configured yet."
  echo -e "         Run: ${BOLD}aws configure${NC}  OR  use OIDC in CI/CD (no keys needed in pipelines)"
fi

print_section "10. Docker Daemon Check"
if docker info &>/dev/null 2>&1; then
  ok "Docker daemon is running"
else
  echo -e "  ${YELLOW}[WARN]${NC}  Docker is installed but daemon is not running."
  echo -e "         Run: ${BOLD}sudo systemctl start docker${NC}  (Linux) or start Docker Desktop (macOS)"
fi

# =============================================================
# SUMMARY
# =============================================================
echo ""
echo -e "${BLUE}${BOLD}=============================================${NC}"
echo -e "${BOLD}  Setup Check Summary${NC}"
echo -e "${BLUE}${BOLD}=============================================${NC}"
echo -e "  ${GREEN}Already installed:${NC}  ${ALREADY_OK}"
echo -e "  ${YELLOW}Newly installed:${NC}    ${INSTALLED}"
if [[ $FAILED -gt 0 ]]; then
  echo -e "  ${RED}Failed to install:${NC}  ${FAILED}  <- Fix these manually"
fi
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All tools are ready! You can now run the project.${NC}"
  echo ""
  echo -e "  Next steps:"
  echo -e "  1. ${BOLD}aws configure${NC}                  # Set your AWS credentials"
  echo -e "  2. ${BOLD}cd rental-roommate-finder${NC}"
  echo -e "  3. ${BOLD}docker-compose up --build${NC}      # Run locally with Docker Compose"
  echo -e "     OR"
  echo -e "  3. ${BOLD}cd terraform && terraform init${NC} # Deploy infra to AWS"
else
  echo -e "${RED}${BOLD}Some tools failed to install. Please fix them manually and re-run this script.${NC}"
fi
echo ""

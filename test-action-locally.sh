#!/bin/bash
set -e

echo "=================================================="
echo "🧪 Simulating GitHub Action Locally"
echo "=================================================="
echo ""
echo "This script runs the EXACT same commands as the action"
echo "but locally on your machine to prove it works."
echo ""
echo "⚠️  WARNING: This will:"
echo "  - Install KubeSolo on your system"
echo "  - Start a Kubernetes cluster"
echo "  - Require sudo access"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "=================================================="
echo "STEP 1: Check for existing container runtimes"
echo "=================================================="

# This is the exact same check from action.yml
if systemctl is-active --quiet docker 2>/dev/null; then
  echo "❌ Docker service is running. Please stop Docker before continuing."
  echo "   Run: sudo systemctl stop docker"
  exit 1
fi

if systemctl is-active --quiet podman 2>/dev/null; then
  echo "❌ Podman service is running. Please stop Podman before continuing."
  exit 1
fi

if systemctl is-active --quiet containerd 2>/dev/null; then
  echo "❌ containerd service is running. Please stop containerd before continuing."
  exit 1
fi

echo "✅ No conflicting container runtimes detected"
echo ""

echo "=================================================="
echo "STEP 2: Install KubeSolo"
echo "=================================================="

# Simulate action inputs
export KUBESOLO_VERSION="latest"
export KUBESOLO_PATH="/var/lib/kubesolo"
export KUBESOLO_LOCAL_STORAGE="true"

# This is the exact same command from action.yml
if [ "${KUBESOLO_VERSION}" = "latest" ]; then
  echo "Running: curl -sfL https://get.kubesolo.io | sudo -E sh -"
  curl -sfL https://get.kubesolo.io | sudo -E sh -
else
  echo "Running: curl -sfL https://get.kubesolo.io | INSTALL_KUBESOLO_VERSION=${KUBESOLO_VERSION} sudo -E sh -"
  curl -sfL https://get.kubesolo.io | INSTALL_KUBESOLO_VERSION="${KUBESOLO_VERSION}" sudo -E sh -
fi

# Set kubeconfig path (same as action)
KUBECONFIG_PATH="${KUBESOLO_PATH}/pki/admin/admin.kubeconfig"
echo "Kubeconfig will be at: ${KUBECONFIG_PATH}"

# Make kubeconfig accessible (same as action)
sudo chmod 644 "${KUBECONFIG_PATH}"

echo "✅ KubeSolo installed"
echo ""

echo "=================================================="
echo "STEP 3: Configure kubectl"
echo "=================================================="

# Set KUBECONFIG (same as action)
export KUBECONFIG="${KUBECONFIG_PATH}"
echo "KUBECONFIG=${KUBECONFIG}"

# Install kubectl if not present (same as action)
if ! command -v kubectl &> /dev/null; then
  echo "Installing kubectl..."
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  rm kubectl
  echo "✅ kubectl installed"
else
  echo "✅ kubectl already installed"
fi

echo "kubectl version: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
echo ""

echo "=================================================="
echo "STEP 4: Wait for cluster to be ready"
echo "=================================================="

TIMEOUT=300
echo "Waiting for KubeSolo cluster to be ready (timeout: ${TIMEOUT}s)..."

start_time=$(date +%s)
while true; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))
  
  if [ $elapsed -gt ${TIMEOUT} ]; then
    echo "❌ Timeout waiting for cluster to be ready"
    exit 1
  fi
  
  # Check if API server is responding (same as action)
  if kubectl cluster-info &>/dev/null; then
    echo "✅ API server is responding"
    
    # Check if node is ready (same as action)
    if kubectl wait --for=condition=Ready nodes --all --timeout=10s &>/dev/null; then
      echo "✅ Node is ready"
      break
    fi
  fi
  
  echo "⏳ Cluster not ready yet, waiting... (${elapsed}/${TIMEOUT}s)"
  sleep 5
done

echo "✅ KubeSolo cluster is ready!"
echo ""

echo "=================================================="
echo "STEP 5: Verify installation"
echo "=================================================="

echo "Cluster Info:"
kubectl cluster-info

echo ""
echo "Node Status:"
kubectl get nodes -o wide

echo ""
echo "System Pods:"
kubectl get pods -A

echo ""
echo "Kubernetes Version:"
kubectl version --short 2>/dev/null || kubectl version

echo ""
echo "=================================================="
echo "STEP 6: Test with a deployment"
echo "=================================================="

echo "Creating nginx deployment..."
kubectl create deployment nginx-test --image=nginx:alpine

echo "Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/nginx-test

echo "✅ Deployment successful!"

echo ""
kubectl get deployments
kubectl get pods

echo ""
echo "Cleaning up test deployment..."
kubectl delete deployment nginx-test

echo ""
echo "=================================================="
echo "🎉 SUCCESS! The action works!"
echo "=================================================="
echo ""
echo "Summary:"
echo "  ✅ KubeSolo installed"
echo "  ✅ kubectl configured"
echo "  ✅ Cluster is ready"
echo "  ✅ Can deploy workloads"
echo ""
echo "This proves your GitHub Action will work!"
echo ""
echo "Kubeconfig is at: ${KUBECONFIG}"
echo ""
echo "To use the cluster:"
echo "  export KUBECONFIG=${KUBECONFIG}"
echo "  kubectl get nodes"
echo ""
echo "To stop KubeSolo:"
echo "  sudo systemctl stop kubesolo"
echo ""
echo "To uninstall:"
echo "  sudo systemctl stop kubesolo"
echo "  sudo rm -rf /var/lib/kubesolo /usr/local/bin/kubesolo"
echo "=================================================="

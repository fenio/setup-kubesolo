#!/usr/bin/env bash
set -e

echo "::group::Installing KubeSolo"
echo "Starting KubeSolo setup..."

# Remove existing container runtimes (required by KubeSolo)
echo "Removing existing container runtimes..."

# Stop services
sudo systemctl stop docker docker.socket containerd podman 2>/dev/null || true
sudo systemctl disable docker docker.socket containerd podman 2>/dev/null || true

# Kill any remaining processes
sudo pkill -9 dockerd 2>/dev/null || true
sudo pkill -9 containerd 2>/dev/null || true
sudo pkill -9 podman 2>/dev/null || true

# Rename binaries instead of uninstalling (much faster)
for bin in docker dockerd containerd containerd-shim containerd-shim-runc-v2 runc podman; do
  if [ -f "/usr/bin/$bin" ]; then
    sudo mv "/usr/bin/$bin" "/usr/bin/${bin}.bak"
  fi
done

# Remove data directories and sockets
sudo rm -rf /var/lib/docker /var/lib/containerd
sudo rm -f /var/run/docker.sock /var/run/containerd/containerd.sock

# Remove docker0 network interface
sudo ip link set docker0 down 2>/dev/null || true
sudo ip link delete docker0 2>/dev/null || true

# Flush ALL iptables rules (nuclear option - required for clean KubeSolo networking)
# This removes everything including Docker rules that interfere with KubeSolo's CNI
echo "Flushing all iptables rules..."
sudo iptables -F
sudo iptables -X
sudo iptables -t nat -F
sudo iptables -t nat -X
sudo iptables -t mangle -F
sudo iptables -t mangle -X
sudo iptables -t raw -F
sudo iptables -t raw -X
sudo iptables -P INPUT ACCEPT
sudo iptables -P FORWARD ACCEPT
sudo iptables -P OUTPUT ACCEPT

echo "✓ Container runtimes removed"

# Get inputs from environment variables (set by GitHub Actions)
VERSION="${INPUT_VERSION:-latest}"
WAIT_FOR_READY="${INPUT_WAIT_FOR_READY:-true}"
TIMEOUT="${INPUT_TIMEOUT:-60}"
DNS_READINESS="${INPUT_DNS_READINESS:-true}"
LOCAL_STORAGE_SHARED_PATH="${INPUT_LOCAL_STORAGE_SHARED_PATH:-}"

echo "Configuration: version=$VERSION, wait-for-ready=$WAIT_FOR_READY, timeout=${TIMEOUT}s, dns-readiness=$DNS_READINESS, local-storage-shared-path=$LOCAL_STORAGE_SHARED_PATH"

# Resolve version if 'latest'
if [ "$VERSION" = "latest" ]; then
    echo "Resolving latest version..."
    ACTUAL_VERSION=$(curl -sL https://api.github.com/repos/portainer/kubesolo/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    if [ -z "$ACTUAL_VERSION" ]; then
        echo "::error::Failed to resolve latest version from GitHub API"
        exit 1
    fi
    echo "Latest version: $ACTUAL_VERSION"
else
    ACTUAL_VERSION="$VERSION"
fi

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)
        BINARY_ARCH="amd64"
        ;;
    aarch64|arm64)
        BINARY_ARCH="arm64"
        ;;
    armv7l)
        BINARY_ARCH="arm"
        ;;
    *)
        echo "::error::Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "Architecture: $ARCH -> $BINARY_ARCH"

# Download and install KubeSolo
DOWNLOAD_URL="https://github.com/portainer/kubesolo/releases/download/${ACTUAL_VERSION}/kubesolo-${ACTUAL_VERSION}-linux-${BINARY_ARCH}.tar.gz"
echo "Downloading from: $DOWNLOAD_URL"

curl -sfL "$DOWNLOAD_URL" -o /tmp/kubesolo.tar.gz
tar -xzf /tmp/kubesolo.tar.gz -C /tmp

echo "Installing binary to /usr/local/bin/kubesolo..."
sudo mv /tmp/kubesolo /usr/local/bin/kubesolo
sudo chmod +x /usr/local/bin/kubesolo

# Create data directory
sudo mkdir -p /var/lib/kubesolo

# Clean up existing CNI directory to prevent conflicts
# KubeSolo needs to create a symlink at /opt/cni/bin for its embedded CNI plugins
# This can fail if the directory already exists and contains files (e.g., on self-hosted runners)
if [ -d "/opt/cni/bin" ]; then
    echo "Cleaning existing CNI directory to prevent conflicts..."
    sudo rm -rf /opt/cni/bin
fi

# Create systemd service
echo "Creating systemd service..."

# Build ExecStart command with optional flags
KUBESOLO_CMD="/usr/local/bin/kubesolo --path=/var/lib/kubesolo"
if [ -n "$LOCAL_STORAGE_SHARED_PATH" ]; then
    KUBESOLO_CMD="$KUBESOLO_CMD --local-storage-shared-path=$LOCAL_STORAGE_SHARED_PATH"
fi

cat << EOF | sudo tee /etc/systemd/system/kubesolo.service > /dev/null
[Unit]
Description=KubeSolo - Lightweight Kubernetes
Documentation=https://github.com/portainer/kubesolo
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
Restart=on-failure
RestartSec=5s
ExecStart=$KUBESOLO_CMD
KillMode=process
Delegate=yes
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity

[Install]
WantedBy=multi-user.target
EOF

# Start KubeSolo service
echo "Starting KubeSolo service..."
sudo systemctl daemon-reload
sudo systemctl enable kubesolo
sudo systemctl start kubesolo

# Clean up
rm -f /tmp/kubesolo.tar.gz

# Wait for kubeconfig to be generated
echo "Waiting for kubeconfig generation..."
sleep 5

# Set kubeconfig path
KUBECONFIG_PATH="/var/lib/kubesolo/pki/admin/admin.kubeconfig"

# Make kubeconfig accessible
sudo chmod 644 "$KUBECONFIG_PATH" 2>/dev/null || true

# Export KUBECONFIG for subsequent steps
echo "KUBECONFIG=$KUBECONFIG_PATH" >> "$GITHUB_ENV"
echo "kubeconfig=$KUBECONFIG_PATH" >> "$GITHUB_OUTPUT"
echo "KUBECONFIG exported: $KUBECONFIG_PATH"

echo "✓ KubeSolo installed successfully"
echo "::endgroup::"

# Wait for cluster ready (if requested)
if [ "$WAIT_FOR_READY" = "true" ]; then
    echo "::group::Waiting for cluster ready"
    echo "Waiting for KubeSolo cluster to be ready (timeout: ${TIMEOUT}s)..."
    
    START_TIME=$(date +%s)
    
    while true; do
        ELAPSED=$(($(date +%s) - START_TIME))
        
        if [ "$ELAPSED" -gt "$TIMEOUT" ]; then
            echo "::error::Timeout waiting for cluster to be ready"
            echo "=== KubeSolo Service Status ==="
            sudo systemctl status kubesolo || true
            echo "=== KubeSolo Logs (last 100 lines) ==="
            sudo journalctl -u kubesolo -n 100 --no-pager || true
            exit 1
        fi
        
        # Check if service is active
        if sudo systemctl is-active --quiet kubesolo; then
            # Check if API server port is listening
            if ss -tlnp 2>/dev/null | grep -q ":6443 "; then
                # Check if kubeconfig exists
                if sudo test -f "$KUBECONFIG_PATH"; then
                    # Make kubeconfig accessible
                    sudo chmod 644 "$KUBECONFIG_PATH" 2>/dev/null || true
                    
                    # Check if kubectl can connect
                    if kubectl --kubeconfig "$KUBECONFIG_PATH" get nodes --no-headers &>/dev/null; then
                        # Check if node is Ready
                        if kubectl --kubeconfig "$KUBECONFIG_PATH" get nodes --no-headers | grep -q " Ready "; then
                            echo "✓ KubeSolo cluster is fully ready!"
                            echo "::endgroup::"
                            break
                        fi
                    fi
                fi
            fi
        fi
        
        echo "Cluster not ready yet, waiting... (${ELAPSED}/${TIMEOUT}s)"
        sleep 5
    done
fi

# DNS readiness check (if requested)
if [ "$DNS_READINESS" = "true" ]; then
  echo "::group::Testing DNS readiness"
  echo "Verifying CoreDNS and DNS resolution..."
  
  # Wait for CoreDNS pods to be ready
  # KubeSolo uses different labeling, so we check by pod name pattern
  echo "Waiting for CoreDNS to be ready..."
  for i in $(seq 1 60); do
    if kubectl --kubeconfig "$KUBECONFIG_PATH" get pods -n kube-system 2>/dev/null | grep -q "coredns.*1/1.*Running"; then
      echo "✓ CoreDNS is ready"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "::error::Timeout waiting for CoreDNS"
      kubectl --kubeconfig "$KUBECONFIG_PATH" get pods -n kube-system || true
      exit 1
    fi
    echo "Waiting for CoreDNS... ($i/60)"
    sleep 2
  done
  
  # Create a test pod and verify DNS resolution
  kubectl --kubeconfig "$KUBECONFIG_PATH" run dns-test --image=public.ecr.aws/docker/library/busybox:stable --restart=Never -- sleep 300
  kubectl --kubeconfig "$KUBECONFIG_PATH" wait --for=condition=ready --timeout=60s pod/dns-test
  
  # Test DNS with retries (CoreDNS may need a moment to be fully functional)
  DNS_OK=false
  for i in $(seq 1 10); do
    if kubectl --kubeconfig "$KUBECONFIG_PATH" exec dns-test -- nslookup kubernetes.default.svc.cluster.local; then
      echo "✓ DNS resolution is working"
      DNS_OK=true
      break
    fi
    echo "DNS not ready yet, retrying... ($i/10)"
    sleep 2
  done
  
  if [ "$DNS_OK" = "false" ]; then
    echo "::error::DNS resolution failed"
    kubectl --kubeconfig "$KUBECONFIG_PATH" delete pod dns-test --ignore-not-found
    exit 1
  fi
  
  # Cleanup test pod
  kubectl --kubeconfig "$KUBECONFIG_PATH" delete pod dns-test --ignore-not-found
  echo "::endgroup::"
fi

echo "✓ KubeSolo setup completed successfully!"

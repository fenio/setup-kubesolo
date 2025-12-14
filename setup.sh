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

# Clean up Docker iptables rules
# Order matters: remove references first, then flush chains, then delete chains

# 1. Remove jump rules from built-in chains
sudo iptables -D FORWARD -j DOCKER-USER 2>/dev/null || true
sudo iptables -D FORWARD -j DOCKER-ISOLATION-STAGE-1 2>/dev/null || true
sudo iptables -D FORWARD -o docker0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
sudo iptables -D FORWARD -o docker0 -j DOCKER 2>/dev/null || true
sudo iptables -D FORWARD -i docker0 ! -o docker0 -j ACCEPT 2>/dev/null || true
sudo iptables -D FORWARD -i docker0 -o docker0 -j ACCEPT 2>/dev/null || true

# 2. Remove NAT rules
sudo iptables -t nat -D PREROUTING -m addrtype --dst-type LOCAL -j DOCKER 2>/dev/null || true
sudo iptables -t nat -D OUTPUT ! -d 127.0.0.0/8 -m addrtype --dst-type LOCAL -j DOCKER 2>/dev/null || true
sudo iptables -t nat -D POSTROUTING -s 172.17.0.0/16 ! -o docker0 -j MASQUERADE 2>/dev/null || true

# 3. Flush and delete Docker chains
for chain in DOCKER DOCKER-ISOLATION-STAGE-1 DOCKER-ISOLATION-STAGE-2 DOCKER-USER; do
  sudo iptables -F $chain 2>/dev/null || true
  sudo iptables -X $chain 2>/dev/null || true
done
sudo iptables -t nat -F DOCKER 2>/dev/null || true
sudo iptables -t nat -X DOCKER 2>/dev/null || true

echo "✓ Container runtimes removed"

# Get inputs from environment variables (set by GitHub Actions)
VERSION="${INPUT_VERSION:-latest}"
WAIT_FOR_READY="${INPUT_WAIT_FOR_READY:-true}"
TIMEOUT="${INPUT_TIMEOUT:-60}"

echo "Configuration: version=$VERSION, wait-for-ready=$WAIT_FOR_READY, timeout=${TIMEOUT}s"

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
cat << 'EOF' | sudo tee /etc/systemd/system/kubesolo.service > /dev/null
[Unit]
Description=KubeSolo - Lightweight Kubernetes
Documentation=https://github.com/portainer/kubesolo
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
Restart=on-failure
RestartSec=5s
ExecStart=/usr/local/bin/kubesolo --path=/var/lib/kubesolo
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

echo "✓ KubeSolo setup completed successfully!"

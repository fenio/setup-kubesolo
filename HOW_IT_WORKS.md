# How It Works

This document explains how the Setup KubeSolo Action works internally.

## The Simplified Approach

The action performs these steps:

1. **Remove conflicting container runtimes** (Docker, Podman, containerd)
2. **Install KubeSolo** using the official installer
3. **Configure kubectl** with the kubeconfig file
4. **Wait for cluster readiness** (optional)
5. **Output kubeconfig path**

## Step-by-Step Breakdown

### 1. Remove Existing Container Runtimes

```bash
# Stop and disable Docker
systemctl stop docker docker.socket containerd
systemctl disable docker docker.socket containerd

# Remove packages
apt-get remove -y docker.io docker-ce containerd podman

# Clean up sockets and runtime files
rm -f /var/run/docker.sock /run/containerd/containerd.sock
```

**Why?** GitHub's `ubuntu-latest` runners come with Docker pre-installed, which conflicts with KubeSolo's networking.

**Safe?** Yes! GitHub Actions runners are ephemeral (destroyed after each job).

### 2. Install KubeSolo

```bash
# For latest version
curl -sfL https://get.kubesolo.io | sudo -E sh -

# For specific version
export INSTALL_KUBESOLO_VERSION="v0.1.7-beta"
curl -sfL https://get.kubesolo.io | sudo -E sh -
```

This downloads and runs the official KubeSolo installer.

### 3. Configure kubectl

```bash
export KUBECONFIG="/var/lib/kubesolo/pki/admin/admin.kubeconfig"
kubectl version --client
```

Sets the `KUBECONFIG` environment variable for the current and subsequent steps.

### 4. Wait for Cluster to be Ready

```bash
timeout 300 bash -c 'until kubectl get nodes 2>/dev/null; do sleep 2; done'
kubectl wait --for=condition=Ready nodes --all --timeout=300s
```

Waits up to 5 minutes (default) for the cluster to become operational.

### 5. Set Outputs

```bash
echo "kubeconfig=/var/lib/kubesolo/pki/admin/admin.kubeconfig" >> $GITHUB_OUTPUT
```

Makes the kubeconfig path available to subsequent steps.

## Why Composite Actions?

The action uses the `composite` type:

```yaml
runs:
  using: 'composite'
  steps:
    - name: Install KubeSolo
      shell: bash
      run: |
        curl -sfL https://get.kubesolo.io | sudo -E sh -
```

**Benefits:**
- ✅ No JavaScript/TypeScript required
- ✅ Uses familiar bash scripting
- ✅ Leverages KubeSolo's official installer
- ✅ Fast execution (no container overhead)
- ✅ Easy to maintain

## Key Design Decisions

### 1. Automatic Docker Removal

**Decision:** Automatically remove Docker instead of failing

**Rationale:** 
- GitHub runners are ephemeral
- Docker conflicts with KubeSolo networking
- Users expect the action to "just work"

### 2. Fixed KubeSolo Path

**Decision:** Hardcode path to `/var/lib/kubesolo`

**Rationale:**
- KubeSolo's default and recommended path
- Simplifies action and reduces configuration options
- Matches official installation

### 3. Simple Input Set

**Decision:** Only 3 inputs (version, wait-for-ready, timeout)

**Rationale:**
- Most users only need version selection
- Reduces complexity and maintenance burden
- Follows "convention over configuration"

## Testing

The action includes a single comprehensive test that validates:
- KubeSolo installation
- Cluster startup
- nginx deployment
- Pod readiness

See `.github/workflows/test.yml` for the test implementation.

## Troubleshooting

### Common Issues

**Issue: Timeout waiting for cluster**
- Increase `timeout` input value
- Check GitHub Actions runner resources

**Issue: kubectl not found**
- Action installs kubectl automatically
- Verify the "Configure kubectl" step runs

**Issue: Permission denied**
- Action uses `sudo` (available in GitHub Actions)
- GitHub runners provide necessary permissions

## Under the Hood

When you use:

```yaml
- uses: fenio/setup-kubesolo@v1
  with:
    version: 'latest'
```

GitHub Actions:
1. Clones the action repository
2. Reads `action.yml`
3. Processes inputs (version, wait-for-ready, timeout)
4. Executes each bash script step sequentially
5. Sets environment variables and outputs
6. Makes kubectl and cluster available to subsequent steps

It's just bash scripts running in sequence!

# Setup KubeSolo Action

A GitHub Action for installing and configuring [KubeSolo](https://github.com/portainer/kubesolo) - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines, testing, and development workflows.

## Features

- ✅ Automatic installation of KubeSolo
- ✅ Waits for cluster readiness (checks systemd service and API server port)
- ✅ Outputs kubeconfig path for easy integration
- ✅ Support for shared local storage (ReadWriteMany PVCs)
- ✅ No cleanup required - designed for ephemeral GitHub Actions runners

## Quick Start

```yaml
name: Test with KubeSolo

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        id: kubesolo
        uses: fenio/setup-kubesolo@v5
      
      - name: Deploy and test
        env:
          KUBECONFIG: ${{ steps.kubesolo.outputs.kubeconfig }}
        run: |
          kubectl apply -f k8s/
          kubectl wait --for=condition=available --timeout=60s deployment/my-app
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `version` | KubeSolo version to install (e.g., `v0.1.7-beta`) or `latest` | `latest` |
| `wait-for-ready` | Wait for cluster to be ready before completing | `true` |
| `timeout` | Timeout in seconds to wait for cluster readiness | `120` |
| `dns-readiness` | Wait for CoreDNS to be ready and verify DNS resolution works | `true` |
| `local-storage-shared-path` | Path for shared local storage (enables ReadWriteMany PVCs) | _(disabled)_ |

## Outputs

| Output | Description |
|--------|-------------|
| `kubeconfig` | Path to the kubeconfig file (`/var/lib/kubesolo/pki/admin/admin.kubeconfig`) |

## Examples

### Basic Setup

```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v5
```

### With Shared Storage (ReadWriteMany PVCs)

If you need to use ReadWriteMany (RWX) PersistentVolumeClaims, enable the shared storage path:

```yaml
- name: Setup KubeSolo with shared storage
  uses: fenio/setup-kubesolo@v5
  with:
    local-storage-shared-path: '/opt/local-path-provisioner'
```

This configures the local-path-provisioner to support both ReadWriteOnce (RWO) and ReadWriteMany (RWX) access modes.

## How It Works

This action runs a simple bash script that:
1. Downloads and installs KubeSolo binary
2. Creates a systemd service for KubeSolo
3. Waits for the cluster to become ready
4. Exports the kubeconfig path for use in subsequent steps

**No cleanup needed** - GitHub Actions runners are ephemeral and destroyed after each workflow run, so there's no need to restore system state.

## Requirements

- Runs on `ubuntu-latest` (or any Linux-based runner)
- Requires `sudo` access (provided by default in GitHub Actions)

## Troubleshooting

If the cluster doesn't become ready in time, increase the timeout:

```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v5
  with:
    timeout: '600'  # 10 minutes
```

## Development

This action uses a simple bash script (`setup.sh`) with no compilation required.

To test locally on a Linux VM:

```bash
export INPUT_VERSION="latest"
export INPUT_WAIT_FOR_READY="true"
export INPUT_TIMEOUT="60"
export INPUT_LOCAL_STORAGE_SHARED_PATH=""
export GITHUB_ENV=/tmp/github_env
export GITHUB_OUTPUT=/tmp/github_output

bash setup.sh
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [KubeSolo](https://github.com/portainer/kubesolo) - Ultra-lightweight Kubernetes
- [Portainer](https://www.portainer.io/) - Container management platform

### Other Kubernetes Setup Actions

- [setup-k0s](https://github.com/fenio/setup-k0s) - Zero friction Kubernetes (k0s)
- [setup-k3s](https://github.com/fenio/setup-k3s) - Lightweight Kubernetes (k3s)
- [setup-microk8s](https://github.com/fenio/setup-microk8s) - Lightweight Kubernetes by Canonical
- [setup-minikube](https://github.com/fenio/setup-minikube) - Local Kubernetes (Minikube)
- [setup-talos](https://github.com/fenio/setup-talos) - Secure, immutable Kubernetes OS (Talos)

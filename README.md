# Setup KubeSolo Action

A GitHub Action for installing and configuring [KubeSolo](https://github.com/portainer/kubesolo) - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines, testing, and development workflows.

## Features

- ✅ Automatic installation of KubeSolo
- ✅ Fast disabling of conflicting container runtimes (Docker, Podman, containerd)
- ✅ Waits for cluster readiness (checks systemd service and API server port)
- ✅ Outputs kubeconfig path for easy integration

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
        uses: fenio/setup-kubesolo@v2
      
      - name: Setup kubectl
        uses: fenio/setup-krew@v1
        env:
          KUBECONFIG: ${{ steps.kubesolo.outputs.kubeconfig }}
      
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
| `timeout` | Timeout in seconds to wait for cluster readiness | `60` |

## Outputs

| Output | Description |
|--------|-------------|
| `kubeconfig` | Path to the kubeconfig file (`/var/lib/kubesolo/pki/admin/admin.kubeconfig`) |

## Requirements

- Runs on `ubuntu-latest` (or any Linux-based runner)
- Requires `sudo` access (provided by default in GitHub Actions)

**Note:** The action masks and disables Docker and other container runtimes that conflict with KubeSolo by stopping services and renaming binaries. This is much faster than package removal and works perfectly on ephemeral GitHub Actions runners.

## Troubleshooting

If the cluster doesn't become ready in time, increase the timeout:

```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v2
  with:
    timeout: '600'  # 10 minutes
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [KubeSolo](https://github.com/portainer/kubesolo) - Ultra-lightweight Kubernetes
- [Portainer](https://www.portainer.io/) - Container management platform

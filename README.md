# Setup KubeSolo Action

A GitHub Action for installing and configuring [KubeSolo](https://github.com/portainer/kubesolo) - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines, testing, and development workflows.

## Features

- ✅ Automatic installation of KubeSolo
- ✅ Automatic removal of conflicting container runtimes (Docker, Podman, containerd)
- ✅ kubectl configured and ready to use
- ✅ Waits for cluster readiness

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
        uses: fenio/setup-kubesolo@v1
      
      - name: Deploy and test
        run: |
          kubectl apply -f k8s/
          kubectl wait --for=condition=available --timeout=60s deployment/my-app
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `version` | KubeSolo version to install (e.g., `v0.1.7-beta`) or `latest` | `latest` |
| `wait-for-ready` | Wait for cluster to be ready before completing | `true` |
| `timeout` | Timeout in seconds to wait for cluster readiness | `300` |

## Outputs

| Output | Description |
|--------|-------------|
| `kubeconfig` | Path to the kubeconfig file (`/var/lib/kubesolo/pki/admin/admin.kubeconfig`) |
| `cluster-info` | Cluster information |

## Requirements

- Runs on `ubuntu-latest` (or any Linux-based runner)
- Requires `sudo` access (provided by default in GitHub Actions)

**Note:** The action automatically removes Docker and other container runtimes that conflict with KubeSolo. This is safe on ephemeral GitHub Actions runners.

## Troubleshooting

If the cluster doesn't become ready in time, increase the timeout:

```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v1
  with:
    timeout: '600'  # 10 minutes
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [KubeSolo](https://github.com/portainer/kubesolo) - Ultra-lightweight Kubernetes
- [Portainer](https://www.portainer.io/) - Container management platform

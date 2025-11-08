# Setup KubeSolo Action

A GitHub Action for installing and configuring [KubeSolo](https://github.com/portainer/kubesolo) - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines, testing, and development workflows.

## Features

- ✅ Automatic installation of KubeSolo
- ✅ Fast disabling of conflicting container runtimes (Docker, Podman, containerd)
- ✅ Waits for cluster readiness (checks systemd service and API server port)
- ✅ Outputs kubeconfig path for easy integration
- ✅ **Automatic cleanup and system restoration** - Runs post-cleanup after your workflow completes

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
        uses: fenio/setup-kubesolo@v3
      
      - name: Deploy and test
        env:
          KUBECONFIG: ${{ steps.kubesolo.outputs.kubeconfig }}
        run: |
          kubectl apply -f k8s/
          kubectl wait --for=condition=available --timeout=60s deployment/my-app
      
      # Cleanup happens automatically after this job completes!
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

## How It Works

### Setup Phase
1. Temporarily disables conflicting container runtimes (Docker, containerd, podman)
2. Backs up runtime binaries by renaming them to `.bak`
3. Installs KubeSolo
4. Waits for the cluster to become ready

### Automatic Cleanup (Post-run)
After your workflow steps complete (whether successful or failed), the action automatically:
1. Stops and removes KubeSolo
2. Restores all backed-up container runtime binaries
3. Unmasks and restarts container runtime services
4. Leaves your system in its original state

This is achieved using GitHub Actions' `post:` hook, similar to how `actions/checkout` cleans up after itself.

## Requirements

- Runs on `ubuntu-latest` (or any Linux-based runner)
- Requires `sudo` access (provided by default in GitHub Actions)

## Troubleshooting

If the cluster doesn't become ready in time, increase the timeout:

```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v3
  with:
    timeout: '600'  # 10 minutes
```

## Development

This action is written in TypeScript and compiled to JavaScript using `@vercel/ncc`.

### Building

```bash
npm install
npm run build
```

The compiled output in `dist/` must be committed to the repository for the action to work.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [KubeSolo](https://github.com/portainer/kubesolo) - Ultra-lightweight Kubernetes
- [Portainer](https://www.portainer.io/) - Container management platform

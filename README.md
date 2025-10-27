# Setup KubeSolo Action

A GitHub Action for installing and configuring [KubeSolo](https://github.com/portainer/kubesolo) - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines, testing, and development workflows.

## Features

- Installs KubeSolo automatically in your GitHub Actions workflow
- Configures kubectl with appropriate credentials
- Waits for cluster readiness before proceeding
- Supports custom configuration options
- Integrates with Portainer Edge
- Zero external dependencies beyond the KubeSolo installer

## Usage

### Basic Example

```yaml
name: Test with KubeSolo

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Deploy application
        run: |
          kubectl apply -f k8s/
          kubectl wait --for=condition=available --timeout=60s deployment/my-app
      
      - name: Run tests
        run: |
          kubectl get pods
          # Run your tests here
```

### Advanced Example

```yaml
name: Advanced KubeSolo Setup

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup KubeSolo with custom configuration
        uses: fenio/setup-kubesolo@v1
        with:
          version: 'v0.1.7-beta'
          kubesolo-path: '/var/lib/kubesolo'
          apiserver-extra-sans: 'my-domain.local,192.168.1.100'
          local-storage: 'true'
          wait-for-ready: 'true'
          timeout: '300'
      
      - name: Verify cluster
        run: |
          kubectl cluster-info
          kubectl get nodes
          kubectl get pods -A
      
      - name: Deploy and test
        run: |
          kubectl create deployment nginx --image=nginx
          kubectl expose deployment nginx --port=80 --type=NodePort
          kubectl wait --for=condition=available --timeout=60s deployment/nginx
```

### Portainer Edge Integration

```yaml
name: KubeSolo with Portainer Edge

on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup KubeSolo with Portainer Edge
        uses: fenio/setup-kubesolo@v1
        with:
          portainer-edge-id: ${{ secrets.PORTAINER_EDGE_ID }}
          portainer-edge-key: ${{ secrets.PORTAINER_EDGE_KEY }}
          portainer-edge-async: 'true'
      
      - name: Deploy to cluster
        run: |
          kubectl apply -f manifests/
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `version` | KubeSolo version to install (e.g., `v0.1.7-beta`, `latest`) | No | `latest` |
| `kubesolo-path` | Path to KubeSolo configuration directory | No | `/var/lib/kubesolo` |
| `apiserver-extra-sans` | Comma-separated list of additional SANs for API server TLS certificate | No | `''` |
| `local-storage` | Enable local storage | No | `true` |
| `portainer-edge-id` | Portainer Edge ID for edge agent integration | No | `''` |
| `portainer-edge-key` | Portainer Edge Key for edge agent integration | No | `''` |
| `portainer-edge-async` | Enable Portainer Edge Async Mode | No | `false` |
| `wait-for-ready` | Wait for cluster to be ready before completing | No | `true` |
| `timeout` | Timeout in seconds to wait for cluster readiness | No | `300` |

## Outputs

| Output | Description |
|--------|-------------|
| `kubeconfig` | Path to the generated kubeconfig file |
| `cluster-info` | KubeSolo cluster information |

## Example Using Outputs

```yaml
- name: Setup KubeSolo
  id: kubesolo
  uses: fenio/setup-kubesolo@v1

- name: Use kubeconfig
  run: |
    echo "Kubeconfig located at: ${{ steps.kubesolo.outputs.kubeconfig }}"
    echo "Cluster info: ${{ steps.kubesolo.outputs.cluster-info }}"
    
    # Use the kubeconfig directly
    kubectl --kubeconfig=${{ steps.kubesolo.outputs.kubeconfig }} get nodes
```

## Requirements

- Runs on `ubuntu-latest` (or any Linux-based runner)
- Requires `sudo` access (provided by default in GitHub Actions)

## Important Notes

### Container Runtime Handling

The action automatically stops any running container runtimes (Docker, Podman, containerd) before installing KubeSolo. This is safe on ephemeral GitHub Actions runners and ensures KubeSolo can manage the container runtime properly.

### Resource Considerations

KubeSolo is designed to be lightweight, but for optimal performance:
- Minimum 512MB RAM recommended
- For resource-constrained environments, consider using external kubectl instead of interacting with the cluster locally

### Offline/Air-Gapped Environments

KubeSolo downloads are required during installation. For air-gapped environments, consider pre-caching the installer or using a custom installation method.

## Use Cases

### Integration Testing

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Deploy test environment
        run: |
          kubectl create namespace test
          kubectl apply -f test/fixtures/ -n test
      
      - name: Run integration tests
        run: npm run test:integration
```

### Helm Chart Testing

```yaml
name: Test Helm Charts

on: [push]

jobs:
  helm-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Install Helm
        uses: azure/setup-helm@v3
      
      - name: Test Helm chart
        run: |
          helm install my-release ./charts/my-app
          helm test my-release
```

### Kubernetes Manifest Validation

```yaml
name: Validate Manifests

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Validate manifests
        run: |
          kubectl apply --dry-run=client -f k8s/
          kubectl apply -f k8s/
          kubectl get all
```

## Troubleshooting

### Cluster not ready timeout

If you encounter timeout issues:
```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v1
  with:
    timeout: '600'  # Increase timeout to 10 minutes
```

### Check cluster logs

```yaml
- name: Debug cluster
  if: failure()
  run: |
    sudo journalctl -u kubesolo -n 100
    kubectl get events -A
```

### Skip readiness wait

For debugging purposes, you can skip the readiness check:
```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v1
  with:
    wait-for-ready: 'false'

- name: Manual verification
  run: |
    sleep 30
    kubectl get nodes
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [KubeSolo](https://github.com/portainer/kubesolo) - Ultra-lightweight Kubernetes
- [Portainer](https://www.portainer.io/) - Container management platform

## Support

For issues related to:
- **This GitHub Action**: Open an issue in this repository
- **KubeSolo itself**: Visit the [KubeSolo repository](https://github.com/portainer/kubesolo)
- **Portainer integration**: Check [Portainer documentation](https://docs.portainer.io/)

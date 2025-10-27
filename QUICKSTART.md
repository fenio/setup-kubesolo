# Quick Start Guide

Get started with the Setup KubeSolo Action in 5 minutes!

## For Action Users

### 1. Basic Usage

Add this to your workflow file (`.github/workflows/your-workflow.yml`):

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
          kubectl get all
```

### 2. With Configuration

```yaml
- name: Setup KubeSolo
  uses: fenio/setup-kubesolo@v1
  with:
    version: 'latest'        # default: 'latest'
    wait-for-ready: 'true'   # default: 'true'
    timeout: '300'           # default: '300'
```

### 3. Using Outputs

```yaml
- name: Setup KubeSolo
  id: kubesolo
  uses: fenio/setup-kubesolo@v1

- name: Show cluster info
  run: |
    echo "Kubeconfig at ${{ steps.kubesolo.outputs.kubeconfig }}"
    kubectl cluster-info
```

## For Contributors

### 1. Clone and Setup

```bash
git clone https://github.com/fenio/setup-kubesolo.git
cd setup-kubesolo
```

### 2. Make Changes

Edit `action.yml` to modify the action behavior.

### 3. Test Locally

Create a test workflow that uses your local action:

```yaml
- uses: ./  # Uses the local action
  with:
    version: 'latest'
```

### 4. Run Tests

Push to your fork and check the Actions tab to see test results.

### 5. Submit PR

```bash
git checkout -b feature/my-feature
git commit -am "Add my feature"
git push origin feature/my-feature
```

Then create a Pull Request on GitHub.

## Common Use Cases

### Testing Kubernetes Manifests

```yaml
- uses: fenio/setup-kubesolo@v1
- run: kubectl apply --dry-run=client -f k8s/
```

### Deploying with Helm

```yaml
- uses: fenio/setup-kubesolo@v1
- uses: azure/setup-helm@v4
- run: |
    helm install my-app ./chart
    helm test my-app
```

### Integration Testing

```yaml
- uses: fenio/setup-kubesolo@v1
- run: |
    kubectl apply -f test/fixtures/
    npm run test:integration
```

## Getting Help

- Check [README.md](README.md) for full documentation
- See [EXAMPLES.md](EXAMPLES.md) for more use cases
- Open an issue for bugs or questions
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines

## Next Steps

1. Read the [full documentation](README.md)
2. Try the [examples](EXAMPLES.md)
3. Check the [test workflow](.github/workflows/test.yml)
4. Join the [KubeSolo community](https://github.com/portainer/kubesolo)

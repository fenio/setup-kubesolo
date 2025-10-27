# Examples

This directory contains example workflows demonstrating various use cases for the Setup KubeSolo Action.

## Basic Examples

### Simple Deployment Test

```yaml
name: Simple Deployment Test

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fenio/setup-kubesolo@v1
      - run: kubectl apply -f k8s/
```

### Integration Testing

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Deploy test environment
        run: |
          kubectl create namespace test
          kubectl apply -f test/manifests/ -n test
      
      - name: Run tests
        run: |
          npm install
          npm run test:integration
```

## Advanced Examples

### Multi-Job Workflow

```yaml
name: Multi-Job Testing

on: [push]

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fenio/setup-kubesolo@v1
      - run: kubectl cluster-info

  deploy:
    runs-on: ubuntu-latest
    needs: setup
    steps:
      - uses: actions/checkout@v4
      - uses: fenio/setup-kubesolo@v1
      - run: kubectl apply -f k8s/

  test:
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - uses: actions/checkout@v4
      - uses: fenio/setup-kubesolo@v1
      - run: kubectl get all
```

Note: Each job gets its own runner, so KubeSolo needs to be set up in each job.

### Matrix Testing

```yaml
name: Matrix Testing

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        k8s-version: ['latest', 'v0.1.7-beta']
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo ${{ matrix.k8s-version }}
        uses: fenio/setup-kubesolo@v1
        with:
          version: ${{ matrix.k8s-version }}
      
      - name: Test
        run: kubectl apply -f manifests/
```

### End-to-End Testing

```yaml
name: E2E Tests

on: [push]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Build application
        run: |
          docker build -t my-app:test .
          docker save my-app:test > /tmp/my-app.tar
      
      - name: Load image into cluster
        run: |
          # Import image to containerd
          sudo ctr -n k8s.io images import /tmp/my-app.tar
      
      - name: Deploy application
        run: |
          kubectl apply -f k8s/
          kubectl wait --for=condition=available --timeout=120s deployment/my-app
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Collect logs on failure
        if: failure()
        run: |
          kubectl logs -l app=my-app
          kubectl describe pods -l app=my-app
```

### Database Testing

```yaml
name: Database Integration

on: [push]

jobs:
  test-with-db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Deploy PostgreSQL
        run: |
          kubectl create namespace database
          kubectl apply -f - <<EOF
          apiVersion: apps/v1
          kind: Deployment
          metadata:
            name: postgres
            namespace: database
          spec:
            replicas: 1
            selector:
              matchLabels:
                app: postgres
            template:
              metadata:
                labels:
                  app: postgres
              spec:
                containers:
                - name: postgres
                  image: postgres:15-alpine
                  env:
                  - name: POSTGRES_PASSWORD
                    value: testpassword
                  - name: POSTGRES_DB
                    value: testdb
                  ports:
                  - containerPort: 5432
          ---
          apiVersion: v1
          kind: Service
          metadata:
            name: postgres
            namespace: database
          spec:
            selector:
              app: postgres
            ports:
            - port: 5432
          EOF
      
      - name: Wait for database
        run: |
          kubectl wait --for=condition=available --timeout=120s deployment/postgres -n database
      
      - name: Run database migrations
        run: npm run db:migrate
      
      - name: Run tests
        run: npm test
```

## CI/CD Examples

### Continuous Deployment

```yaml
name: CD Pipeline

on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Validate manifests
        run: |
          kubectl apply --dry-run=server -f k8s/
      
      - name: Test deployment
        run: |
          kubectl apply -f k8s/
          kubectl rollout status deployment/my-app
```

### Helm Chart Publishing

```yaml
name: Publish Helm Chart

on:
  push:
    tags:
      - 'v*'

jobs:
  test-and-publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Setup Helm
        uses: azure/setup-helm@v4
      
      - name: Test Helm chart
        run: |
          helm lint charts/my-app
          helm install test-release charts/my-app
          helm test test-release
      
      - name: Package chart
        run: helm package charts/my-app
      
      - name: Publish to registry
        run: |
          # Your publishing steps here
```

## Debugging Examples

### Debug Failed Deployments

```yaml
name: Debug Workflow

on: [push]

jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup KubeSolo
        uses: fenio/setup-kubesolo@v1
      
      - name: Deploy application
        id: deploy
        continue-on-error: true
        run: kubectl apply -f k8s/
      
      - name: Debug on failure
        if: steps.deploy.outcome == 'failure'
        run: |
          echo "Deployment failed, collecting debug info..."
          kubectl get all -A
          kubectl describe nodes
          kubectl get events -A --sort-by='.lastTimestamp'
          sudo journalctl -u kubesolo -n 100
```

See the [test workflow](../.github/workflows/test.yml) for more comprehensive examples.

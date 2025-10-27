# Testing Your Action Before Publishing

## Method 1: Test Locally (In the Same Repo)

**Fastest method** - Test before even pushing to GitHub!

1. Create the workflow file `.github/workflows/local-test.yml` (already created)
2. Push to GitHub:
   ```bash
   cd /Users/bfenski/setup-kubesolo
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/fenio/setup-kubesolo.git
   git push -u origin main
   ```
3. Go to GitHub Actions tab and watch it run
4. The `uses: ./` syntax means "use the action from this repository"

## Method 2: Test from Another Repository

More realistic test - simulates how users will use it:

1. **Create a test repository** (e.g., `test-kubesolo-action`)

2. **Create this workflow** in the test repo:
   ```yaml
   name: Test KubeSolo Action
   
   on: [push, workflow_dispatch]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - name: Test action from branch
           uses: fenio/setup-kubesolo@main  # Uses your main branch
         
         - name: Verify
           run: |
             kubectl get nodes
             kubectl create deployment test --image=nginx:alpine
             kubectl get all
   ```

3. **Push and run** - This will pull your action from the main branch

## Method 3: Test Specific Branches

Test different features on different branches:

```yaml
# Test from a feature branch
- uses: fenio/setup-kubesolo@feature/my-new-feature

# Test from a specific commit
- uses: fenio/setup-kubesolo@a1b2c3d

# Test from a tag (after creating one)
- uses: fenio/setup-kubesolo@v0.1.0
```

## Method 4: Local Testing with Act

Test GitHub Actions locally on your machine using [act](https://github.com/nektos/act):

```bash
# Install act (macOS)
brew install act

# Run the workflow locally
cd /Users/bfenski/setup-kubesolo
act -j test-local-action

# Note: This has limitations with composite actions and sudo,
# so GitHub testing is more reliable
```

## Method 5: Step-by-Step Manual Testing

If you want to verify the bash scripts work manually:

```bash
# SSH into an Ubuntu machine or VM
# Then run the commands from action.yml manually:

# Check for container runtimes
systemctl is-active --quiet docker 2>/dev/null && echo "Docker running"

# Install KubeSolo
export KUBESOLO_PATH="/var/lib/kubesolo"
curl -sfL https://get.kubesolo.io | sudo -E sh -

# Configure kubectl
export KUBECONFIG="/var/lib/kubesolo/pki/admin/admin.kubeconfig"
kubectl cluster-info
kubectl get nodes

# Wait for ready
kubectl wait --for=condition=Ready nodes --all --timeout=300s

# Verify
kubectl get pods -A
```

## Recommended Testing Flow

**Phase 1: Initial Testing**
1. ✅ Push to GitHub
2. ✅ Run local-test.yml workflow (uses `./`)
3. ✅ Check GitHub Actions logs
4. ✅ Verify cluster starts and kubectl works

**Phase 2: Integration Testing**  
1. ✅ Create test repository
2. ✅ Reference your action: `fenio/setup-kubesolo@main`
3. ✅ Test all input parameters
4. ✅ Test outputs work correctly

**Phase 3: Pre-Release Testing**
1. ✅ Create a pre-release tag: `v0.1.0-beta`
2. ✅ Test using the tag: `fenio/setup-kubesolo@v0.1.0-beta`
3. ✅ Get feedback from a few users
4. ✅ Fix any issues

**Phase 4: Official Release**
1. ✅ Create v1.0.0 release
2. ✅ Publish to marketplace
3. ✅ Update v1 tag to point to v1.0.0

## What to Check in Tests

- [ ] Action completes without errors
- [ ] KubeSolo installs correctly
- [ ] kubectl is configured
- [ ] Cluster becomes ready within timeout
- [ ] Can deploy workloads
- [ ] Outputs are set correctly
- [ ] Different input combinations work
- [ ] Error handling works (e.g., timeout triggers)

## Debugging Failed Tests

If something fails, check:

```yaml
- name: Debug on failure
  if: failure()
  run: |
    echo "=== System Info ==="
    uname -a
    df -h
    free -h
    
    echo "=== KubeSolo Logs ==="
    sudo journalctl -u kubesolo -n 100 --no-pager
    
    echo "=== Kubernetes Events ==="
    kubectl get events -A --sort-by='.lastTimestamp' || true
    
    echo "=== Node Status ==="
    kubectl get nodes -o yaml || true
    
    echo "=== Pods ==="
    kubectl get pods -A -o wide || true
```

## Common Issues and Solutions

### Issue: Permission denied
**Solution**: The action uses `sudo` which is available in GitHub Actions by default

### Issue: Timeout waiting for cluster
**Solution**: Increase timeout or check if runner has enough resources

### Issue: Container runtime conflict
**Solution**: This is expected behavior, validates the check works

### Issue: kubectl not found
**Solution**: Action installs kubectl automatically, verify this step runs

## Quick Test Script

Want to see if I should create a simple test script that validates everything?

```bash
#!/bin/bash
# Quick validation script to run before publishing

echo "🔍 Validating action.yml syntax..."
# Check YAML is valid
python3 -c "import yaml; yaml.safe_load(open('action.yml'))" && echo "✅ Valid YAML"

echo "🔍 Checking required files..."
required_files=("action.yml" "README.md" "LICENSE")
for file in "${required_files[@]}"; do
  [ -f "$file" ] && echo "✅ $file exists" || echo "❌ $file missing"
done

echo "🔍 Checking for placeholder text..."
if grep -r "YOUR_USERNAME\|bfenski" . --exclude-dir=.git; then
  echo "⚠️  Found placeholders to replace"
else
  echo "✅ No placeholders found"
fi

echo "✅ Ready to test on GitHub!"
```

Should I create this validation script for you?

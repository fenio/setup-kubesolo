# How to Test Before Publishing

## TL;DR - Fastest Way to Test

```bash
# 1. Push to GitHub
cd /Users/bfenski/setup-kubesolo
git init
git add .
git commit -m "Initial commit: Setup KubeSolo GitHub Action"
git remote add origin https://github.com/fenio/setup-kubesolo.git
git push -u origin main

# 2. Watch the test workflow run automatically
# Go to: https://github.com/fenio/setup-kubesolo/actions

# 3. The action will test itself using `uses: ./`
```

That's it! The test will run and you'll see if it works.

## Understanding How It Works

### The Magic of Composite Actions

Your `action.yml` file contains:
```yaml
runs:
  using: 'composite'  # ← This means "bash scripts only"
  steps:
    - name: Install KubeSolo
      shell: bash  # ← Just bash commands
      run: |
        curl -sfL https://get.kubesolo.io | sudo -E sh -
```

It's literally just running bash commands that GitHub Actions executes. Nothing magical!

### What Happens When Action Runs

1. GitHub Actions reads your `action.yml`
2. It processes the inputs you provide
3. It runs each bash script step sequentially
4. Each step uses `shell: bash` so it's just like running commands in terminal
5. Outputs are set using `$GITHUB_OUTPUT`

### Why It Will Work

Because it's doing EXACTLY what you'd do manually:
```bash
# This is all your action does:
curl -sfL https://get.kubesolo.io | sudo sh  # ← Install KubeSolo
export KUBECONFIG=/var/lib/kubesolo/pki/admin/admin.kubeconfig
kubectl cluster-info  # ← Verify it works
```

If that works manually (which it does), the action will work!

## Pre-Flight Validation

Run this now to make sure everything is ready:

```bash
cd /Users/bfenski/setup-kubesolo
./validate.sh
```

## Testing Workflow

### Option 1: Auto-Test (When You Push)

We created `.github/workflows/test.yml` that will automatically run when you push. It includes:

- ✅ Basic setup test
- ✅ Custom configuration test  
- ✅ Workload deployment test
- ✅ Helm integration test
- ✅ kubectl operations test
- ✅ Storage test

### Option 2: Manual Test (Using workflow_dispatch)

```bash
# After pushing, go to GitHub and manually trigger:
# https://github.com/fenio/setup-kubesolo/actions
# Click "Run workflow" button
```

### Option 3: Local Test (Using ./local-test.yml)

We created `.github/workflows/local-test.yml` that uses `uses: ./` to test the local action.

## Seeing It Work

After pushing to GitHub, you'll see:

```
Actions Tab → Workflows
  ├─ Test Setup KubeSolo Action (runs automatically)
  │   ├─ ✅ test-basic-setup
  │   ├─ ✅ test-custom-config  
  │   ├─ ✅ test-workload-deployment
  │   ├─ ✅ test-helm-integration
  │   ├─ ✅ test-kubectl-operations
  │   └─ ✅ test-storage
  └─ Local Test (manual trigger)
      └─ ✅ test-local-action
```

## What to Look For in Test Results

Click on any test job and you'll see logs like:

```
Run Setup KubeSolo
  ::group::Checking for existing container runtimes
  No conflicting container runtimes detected
  ::endgroup::
  
  ::group::Installing KubeSolo
  [INFO] Downloading KubeSolo v0.1.7-beta...
  [INFO] Installing to /var/lib/kubesolo...
  [INFO] Starting KubeSolo...
  ::endgroup::
  
  ::group::Waiting for cluster to be ready
  API server is responding
  Node is ready
  KubeSolo cluster is ready!
  ::endgroup::
  
  ::group::Verifying KubeSolo installation
  Cluster Info:
  Kubernetes control plane is running at https://127.0.0.1:6443
  
  Node Status:
  NAME         STATUS   ROLES    AGE   VERSION
  kubesolo-0   Ready    <none>   30s   v1.30.0
  
  ✅ All checks passed!
  ::endgroup::
```

## If You Still Don't Believe It...

Let me show you what the action REALLY does by expanding all the variables:

```bash
# Input: version = 'latest'
# This becomes:
curl -sfL https://get.kubesolo.io | sudo -E sh -

# Input: kubesolo-path = '/var/lib/kubesolo'  
# This becomes:
export KUBESOLO_PATH="/var/lib/kubesolo"

# Input: wait-for-ready = 'true'
# This becomes:
while true; do
  if kubectl wait --for=condition=Ready nodes --all; then
    break
  fi
  sleep 5
done

# Output: kubeconfig path
# This becomes:
echo "kubeconfig=/var/lib/kubesolo/pki/admin/admin.kubeconfig" >> $GITHUB_OUTPUT
```

It's just bash with some GitHub Actions environment variables!

## Common Concerns Addressed

### "What if the KubeSolo installer fails?"
The `curl` command will fail and the action will stop. That's correct behavior.

### "What if the cluster never becomes ready?"
The timeout (300s default) will trigger and fail the action. That's correct behavior.

### "What if kubectl isn't installed?"
The action installs it automatically in the "Configure kubectl" step.

### "What if there's a container runtime running?"
The first step checks for this and fails with a clear error message.

## Real-World Test Scenario

Want to be 100% sure? Here's a complete manual test:

```bash
# 1. Create a fresh Ubuntu VM or container
docker run -it --privileged ubuntu:22.04 bash

# 2. Run the exact same commands as the action
apt-get update && apt-get install -y curl sudo

# 3. Install KubeSolo (same as action does)
curl -sfL https://get.kubesolo.io | sh -

# 4. Configure kubectl (same as action does)
export KUBECONFIG=/var/lib/kubesolo/pki/admin/admin.kubeconfig

# 5. Wait for ready (same as action does)
kubectl wait --for=condition=Ready nodes --all --timeout=300s

# 6. Verify (same as action does)
kubectl get nodes
kubectl get pods -A
```

If that works (and it will), the action works!

## Ready to Test?

Run these commands:

```bash
# Validate everything is ready
cd /Users/bfenski/setup-kubesolo
./validate.sh

# Push to GitHub
git init
git add .
git commit -m "Initial commit: Setup KubeSolo GitHub Action"  
git remote add origin https://github.com/fenio/setup-kubesolo.git
git push -u origin main

# Watch the magic happen
open https://github.com/fenio/setup-kubesolo/actions
```

The tests will run automatically and you'll see if it works!

## Still Skeptical?

That's healthy skepticism! Here's what I recommend:

1. **Run validate.sh** - See that all files are correct
2. **Push to GitHub** - Just commit and push
3. **Watch the logs** - See exactly what happens
4. **If it fails** - We debug together
5. **When it succeeds** - You'll believe it! 😄

The beauty of composite actions is they're just bash scripts. No compilation, no transpilation, no magic. Just commands running in sequence.

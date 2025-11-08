# AGENTS.md

This file provides comprehensive documentation about the setup-kubesolo GitHub Action for AI agents and developers working with this codebase.

## ⚠️ CRITICAL PRINCIPLE: SYSTEM STATE RESTORATION ⚠️

**THE MOST IMPORTANT REQUIREMENT OF THIS ACTION:**

This action MUST leave the system in EXACTLY the same state as it was before the action ran. This is a non-negotiable requirement.

### Why This Matters
GitHub Actions runners may be reused across different workflows. Any changes made during setup (disabling Docker, modifying binaries, installing services) MUST be completely reversed during cleanup. Failure to restore the system state can break subsequent workflows that depend on container runtimes.

### What Must Be Restored
Every operation in the setup phase has a corresponding cleanup operation:

| Setup Operation | Cleanup Operation | Location |
|----------------|-------------------|----------|
| Stop & mask container runtime services | Unmask & restart services | `src/cleanup.ts:86-102` |
| Rename binaries to `.bak` | Restore from `.bak` to original | `src/cleanup.ts:64-77` |
| Remove runtime sockets | Recreated automatically by service restart | `src/cleanup.ts:100` |
| Install KubeSolo binary (`/usr/local/bin/kubesolo`) | Remove KubeSolo binary | `src/cleanup.ts:55` |
| Create systemd service (`/etc/systemd/system/kubesolo.service`) | Stop, disable, remove service & reload daemon | `src/cleanup.ts:39-56` |
| Create KubeSolo data directory (`/var/lib/kubesolo`) | Remove entire directory and contents | `src/cleanup.ts:55` |
| Set KUBECONFIG environment variable | No cleanup needed - job-scoped only | N/A |

### Cleanup Guarantees
- Cleanup runs automatically via GitHub Actions `post:` hook - it ALWAYS runs, even if the workflow fails
- Cleanup is non-failing (`ignoreReturnCode: true`) to ensure it completes even if some operations encounter errors
- The cleanup phase is tested to verify system restoration

### When Making Changes
**BEFORE adding any new setup operation, you MUST add the corresponding cleanup operation.**

If you:
- Create a file → Delete it in cleanup
- Modify a config → Restore original in cleanup
- Stop a service → Restart it in cleanup
- Install a package → Uninstall it in cleanup

**Violating this principle will break other workflows and is unacceptable.**

---

## Project Overview

**setup-kubesolo** is a GitHub Action that installs and configures KubeSolo - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines. The action handles both setup and automatic cleanup/restoration of the system state.

### Key Features
- Automatic installation of KubeSolo with version selection
- Smart disabling of conflicting container runtimes (Docker, Podman, containerd)
- Cluster readiness checks with configurable timeout
- **Automatic post-run cleanup and complete system restoration** (MOST IMPORTANT FEATURE)
- Outputs kubeconfig path for easy integration with kubectl

## Architecture

### Entry Point Flow
The action uses GitHub Actions' `post:` hook mechanism for automatic cleanup:

1. **Main Run** (`src/index.ts`): Entry point that routes to either main or cleanup based on state
2. **Setup Phase** (`src/main.ts`): Handles KubeSolo installation and configuration
3. **Cleanup Phase** (`src/cleanup.ts`): Automatically runs after job completion for restoration

### Execution Phases

#### Phase 1: Setup (src/main.ts)
```
disableContainerRuntimes() → installKubeSolo() → waitForClusterReady()
```

**disableContainerRuntimes()**
- Stops and masks container runtime services (docker, containerd, podman)
- Backs up runtime binaries by renaming to `.bak` extension
- Cleans up runtime sockets
- Location: `src/main.ts:36-71`

**installKubeSolo(version)**
- Resolves 'latest' version or uses specified version
- Detects system architecture (amd64/arm64/arm)
- Downloads and extracts KubeSolo binary from GitHub releases
- Creates systemd service configuration
- Starts and enables KubeSolo service
- Location: `src/main.ts:73-179`

**waitForClusterReady(timeout)**
- Polls for cluster readiness with configurable timeout
- Checks: service active → API port listening → kubeconfig exists → kubectl connects → node Ready
- Shows diagnostics if timeout occurs
- Sets KUBECONFIG output and environment variable
- Location: `src/main.ts:181-276`

#### Phase 2: Cleanup (src/cleanup.ts)
```
stopKubeSolo() → restoreContainerRuntimes() → restoreServices()
```

**stopKubeSolo()**
- Stops and disables KubeSolo systemd service
- Removes all KubeSolo files and service configuration
- Location: `src/cleanup.ts:29-59`

**restoreContainerRuntimes()**
- Restores backed-up runtime binaries from `.bak` files
- Location: `src/cleanup.ts:61-78`

**restoreServices()**
- Unmasks container runtime services
- Attempts to restart previously running services
- Location: `src/cleanup.ts:80-104`

## File Structure

```
setup-kubesolo/
├── src/
│   ├── index.ts         # Entry point - routes to main or cleanup
│   ├── main.ts          # Setup phase implementation
│   └── cleanup.ts       # Cleanup phase implementation
├── dist/                # Compiled JavaScript (via @vercel/ncc)
│   ├── index.js         # Bundled main entry point
│   └── *.map            # Source maps
├── action.yml           # GitHub Action metadata and interface
├── package.json         # Node.js dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── .github/workflows/   # CI/CD workflows
    ├── test.yml         # Test workflow
    └── release.yml      # Release workflow
```

## Key Technical Details

### Action Configuration (action.yml)

**Inputs:**
- `version` (default: 'latest'): KubeSolo version to install
- `wait-for-ready` (default: 'true'): Wait for cluster readiness
- `timeout` (default: '60'): Timeout in seconds for readiness check

**Outputs:**
- `kubeconfig`: Path to kubeconfig file (`/var/lib/kubesolo/pki/admin/admin.kubeconfig`)

**Runtime:**
- Node.js 24 (`node24`)
- Main entry: `dist/index.js`
- Post hook: `dist/index.js` (same file, different execution path)

### Dependencies

**Production:**
- `@actions/core`: GitHub Actions toolkit for inputs/outputs/logging
- `@actions/exec`: Execute shell commands
- `js-yaml`: YAML parsing (if needed for kubeconfig)

**Development:**
- `@vercel/ncc`: Compiles TypeScript and bundles dependencies into single file
- `typescript`: TypeScript compiler

### Build Process

```bash
npm run build  # Uses @vercel/ncc to create dist/index.js
```

**Important:** The `dist/` directory must be committed to the repository for the action to work, as GitHub Actions cannot run build steps before execution.

## State Management

The action uses `core.saveState()` and `core.getState()` to coordinate between main and cleanup phases:

```typescript
// src/main.ts - Set state during main run
core.saveState('isPost', 'true');

// src/index.ts - Check state to determine phase
if (!core.getState('isPost')) {
  // Main run
  main()
} else {
  // Post run (cleanup)
  cleanup()
}
```

## System Requirements

- **OS:** Linux (tested on ubuntu-latest)
- **Permissions:** sudo access (available by default in GitHub Actions)
- **Network:** Internet access to download KubeSolo releases

## Common Modification Scenarios

### Adding New Configuration Options

1. Add input to `action.yml`:
```yaml
inputs:
  new-option:
    description: 'Description of the new option'
    required: false
    default: 'default-value'
```

2. Read input in `src/main.ts`:
```typescript
const newOption = core.getInput('new-option');
```

3. Update README.md documentation

### Modifying Installation Logic

The installation logic is in `src/main.ts:73-179`. Key areas:
- Version resolution: lines 80-91
- Architecture detection: lines 93-118
- Binary download: lines 120-134
- Systemd service configuration: lines 138-162

### Adjusting Cleanup Behavior

**CRITICAL:** Cleanup logic is in `src/cleanup.ts`. The cleanup is designed to be non-failing (uses `ignoreReturnCode: true`) to avoid breaking workflows if cleanup encounters issues.

**MANDATORY RULE:** Every modification to setup logic MUST have a corresponding cleanup operation. Review the "CRITICAL PRINCIPLE: SYSTEM STATE RESTORATION" section at the top of this document before making any changes.

## Testing Strategy

### Local Testing
Cannot run GitHub Actions locally, but you can:
1. Extract shell commands from TypeScript
2. Test shell commands manually on a Linux VM
3. Use act (https://github.com/nektos/act) for local action simulation

### CI Testing
The repository should have `.github/workflows/test.yml` that:
1. Installs the action
2. Verifies cluster is ready
3. Runs kubectl commands
4. Verifies cleanup restores system state

### Testing Checklist
**Setup Phase:**
- [ ] KubeSolo installs successfully
- [ ] Cluster becomes ready within timeout
- [ ] kubectl can connect and list nodes

**Cleanup Phase (CRITICAL - MUST VERIFY):**
- [ ] Cleanup removes ALL KubeSolo files
- [ ] Container runtime services are restored to original state
- [ ] All backed-up binaries are restored
- [ ] No leftover processes or sockets
- [ ] System can run Docker/containerd workflows after cleanup
- [ ] No orphaned systemd services remain

## Debugging

### Enable Debug Logging
Set repository secret: `ACTIONS_STEP_DEBUG = true`

### Key Log Messages
- "Starting KubeSolo setup..." - Main phase begins
- "Container runtimes disabled" - Runtime backup complete
- "KubeSolo installed successfully" - Installation complete
- "KubeSolo cluster is fully ready!" - Cluster ready
- "Starting cleanup..." - Cleanup phase begins
- "System state restored" - Cleanup complete

### Diagnostic Information
When cluster readiness times out, `showDiagnostics()` (`src/main.ts:278-301`) displays:
- KubeSolo service status
- Journal logs (last 100 lines)
- Kubeconfig directory contents
- Listening ports
- Network interfaces

## Version History

- **v3.x**: TypeScript rewrite with automatic cleanup
- **v2.x**: Previous iteration (if applicable)
- **v1.x**: Initial release (if applicable)

## Related Resources

- **KubeSolo Project**: https://github.com/portainer/kubesolo
- **GitHub Actions Documentation**: https://docs.github.com/actions
- **Node.js Actions Guide**: https://docs.github.com/actions/creating-actions/creating-a-javascript-action

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Development Workflow
1. Make changes to `src/*.ts`
2. **CRITICAL:** If modifying setup phase, add corresponding cleanup operations
3. Run `npm run build` to compile
4. Commit both `src/` and `dist/` changes
5. Test in a workflow on GitHub - verify BOTH setup AND cleanup work correctly
6. Test that subsequent workflows using Docker/containerd still work after your action runs
7. Create pull request

### Release Process
Releases are typically managed via GitHub Actions workflow (`.github/workflows/release.yml`). Tags should follow semantic versioning (e.g., v3.0.0).

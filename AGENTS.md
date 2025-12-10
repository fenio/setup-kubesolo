# AGENTS.md

This file provides comprehensive documentation about the setup-kubesolo GitHub Action for AI agents and developers working with this codebase.

## Project Overview

**setup-kubesolo** is a GitHub Action that installs and configures KubeSolo - an ultra-lightweight, single-node Kubernetes distribution perfect for CI/CD pipelines. This action uses a simple shell script approach for maximum simplicity and transparency.

### Key Features
- Simple bash script implementation (no Node.js/TypeScript complexity)
- Automatic installation of KubeSolo with version selection
- Cluster readiness checks with configurable timeout
- Outputs kubeconfig path for easy integration with kubectl
- No cleanup required - relies on GitHub Actions' ephemeral runners

### Design Philosophy
This action prioritizes **simplicity and transparency** over complex state management:
- **Single shell script**: All logic in one readable bash script
- **No cleanup**: Designed for ephemeral GitHub Actions runners that are discarded after use
- **No dependencies**: Only requires bash and standard Linux utilities
- **No compilation**: No build step needed - the script is used directly

## Architecture

### Simple Flow
The action is a **composite action** that runs a single bash script (`setup.sh`):

```
setup.sh → Install KubeSolo → Wait for Ready → Export KUBECONFIG
```

### File Structure

```
setup-kubesolo/
├── setup.sh             # Main installation script (the entire implementation)
├── action.yml           # GitHub Action metadata (defines composite action)
├── README.md            # User-facing documentation
├── AGENTS.md            # This file - developer/AI documentation
├── CHANGELOG.md         # Version history
├── CONTRIBUTING.md      # Contribution guidelines
└── LICENSE              # MIT license
```

## How It Works

### action.yml (Action Interface)
Defines a **composite action** that:
- Accepts three inputs: `version`, `wait-for-ready`, `timeout`
- Runs `setup.sh` with inputs passed as environment variables
- Outputs the `kubeconfig` path for subsequent workflow steps

### setup.sh (Implementation)
A single bash script that:

1. **Resolves Version** (lines 13-24)
   - If version is "latest", queries GitHub API for latest release tag
   - Otherwise uses the specified version

2. **Detects Architecture** (lines 26-42)
   - Runs `uname -m` to detect system architecture
   - Maps to KubeSolo binary naming: amd64, arm64, or arm

3. **Downloads & Installs Binary** (lines 46-58)
   - Constructs download URL from GitHub releases
   - Downloads and extracts tar.gz
   - Installs to `/usr/local/bin/kubesolo`

4. **Creates systemd Service** (lines 60-89)
   - Creates `/etc/systemd/system/kubesolo.service`
   - Enables and starts the service
   - KubeSolo runs as a systemd service in the background

5. **Exports KUBECONFIG** (lines 94-107)
   - Sets `GITHUB_ENV` for subsequent workflow steps
   - Sets `GITHUB_OUTPUT` for action output
   - Makes kubeconfig readable by runner user

6. **Waits for Cluster Ready** (lines 111-152, if enabled)
   - Polls for cluster readiness with configurable timeout
   - Checks: service active → port 6443 listening → kubeconfig exists → kubectl connects → node Ready
   - Shows diagnostic logs if timeout occurs

## Key Technical Details

### Action Configuration (action.yml)

**Inputs:**
- `version` (default: 'latest'): KubeSolo version to install
- `wait-for-ready` (default: 'true'): Wait for cluster readiness
- `timeout` (default: '60'): Timeout in seconds for readiness check

**Outputs:**
- `kubeconfig`: Path to kubeconfig file (`/var/lib/kubesolo/pki/admin/admin.kubeconfig`)

**Runtime:**
- Composite action (runs shell script directly)
- No Node.js or compilation required
- Shell: bash

### No Dependencies Required
The action only requires:
- Bash shell
- Standard Linux utilities: `curl`, `tar`, `sudo`, `systemctl`
- These are all available by default on GitHub Actions runners

### No Cleanup Needed
GitHub Actions runners are **ephemeral** - they are destroyed after the workflow completes. This means:
- No need to restore system state
- No need to stop services or remove files
- No need for complex cleanup logic
- Simpler, more maintainable code

## System Requirements

- **OS:** Linux (tested on ubuntu-latest)
- **Permissions:** sudo access (available by default in GitHub Actions)
- **Network:** Internet access to download KubeSolo releases from GitHub

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

2. Pass to script via environment variable in `action.yml`:
```yaml
env:
  INPUT_NEW_OPTION: ${{ inputs.new-option }}
```

3. Read in `setup.sh`:
```bash
NEW_OPTION="${INPUT_NEW_OPTION:-default-value}"
```

4. Update README.md documentation

### Modifying Installation Logic

All installation logic is in `setup.sh`. Key sections:
- Version resolution: lines 13-24
- Architecture detection: lines 26-42
- Binary download: lines 46-51
- Systemd service creation: lines 60-89
- Cluster readiness checks: lines 111-152

### Adjusting Readiness Checks

The readiness polling logic is in lines 111-152 of `setup.sh`. It checks multiple conditions in sequence:
1. Service is active
2. Port 6443 is listening
3. Kubeconfig file exists
4. kubectl can connect
5. Node status is Ready

## Testing Strategy

### Local Testing
You can test the script directly on a Linux VM:
```bash
export INPUT_VERSION="latest"
export INPUT_WAIT_FOR_READY="true"
export INPUT_TIMEOUT="60"
export GITHUB_ENV=/tmp/github_env
export GITHUB_OUTPUT=/tmp/github_output

bash setup.sh
```

### CI Testing
Create a test workflow (`.github/workflows/test.yml`) that:
1. Uses the action to install KubeSolo
2. Verifies cluster is ready
3. Runs kubectl commands to test cluster functionality

### Testing Checklist
- [ ] KubeSolo installs successfully
- [ ] Cluster becomes ready within timeout
- [ ] kubectl can connect and list nodes
- [ ] KUBECONFIG environment variable is set correctly
- [ ] Works with different versions (latest, specific version tags)
- [ ] Works on different architectures (if applicable)

## Debugging

### Enable Debug Mode
In your workflow, set:
```yaml
- uses: fenio/setup-kubesolo@v4
  env:
    RUNNER_DEBUG: 1
```

Or set repository secret: `ACTIONS_STEP_DEBUG = true`

### Key Log Messages
- "Starting KubeSolo setup..." - Script begins
- "Resolving latest version..." - Fetching version from GitHub API
- "Architecture: ..." - System architecture detected
- "Downloading from: ..." - Binary download URL
- "Starting KubeSolo service..." - systemd service starting
- "KUBECONFIG exported: ..." - Environment variable set
- "Waiting for KubeSolo cluster to be ready..." - Readiness checks begin
- "✓ KubeSolo cluster is fully ready!" - Cluster ready
- "✓ KubeSolo setup completed successfully!" - Complete

### Diagnostic Information
When cluster readiness times out, the script displays:
- KubeSolo service status (`systemctl status kubesolo`)
- Journal logs (last 100 lines from `journalctl`)

### Manual Verification
SSH into the runner (using action like `mxschmitt/action-tmate`) and check:
```bash
sudo systemctl status kubesolo
sudo journalctl -u kubesolo -n 100
kubectl --kubeconfig /var/lib/kubesolo/pki/admin/admin.kubeconfig get nodes
```

## Version History

- **v4.x**: Simplified shell script implementation (no TypeScript, no cleanup)
- **v3.x**: TypeScript implementation with automatic cleanup
- **v2.x and earlier**: Previous implementations

## Related Resources

- **KubeSolo Project**: https://github.com/portainer/kubesolo
- **GitHub Actions Documentation**: https://docs.github.com/actions
- **Composite Actions Guide**: https://docs.github.com/actions/creating-actions/creating-a-composite-action

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Development Workflow
1. Make changes to `setup.sh` or `action.yml`
2. Test locally on a Linux VM if possible
3. Commit changes (no build step needed!)
4. Test in a workflow on GitHub
5. Create pull request

### Release Process
Releases are typically managed via GitHub Actions workflow (`.github/workflows/release.yml`). Tags should follow semantic versioning (e.g., v4.0.0).

### Why No Cleanup?

**GitHub Actions runners are ephemeral** - they are created fresh for each workflow run and destroyed immediately after. This means:

1. **No shared state**: Each workflow gets a clean runner
2. **No conflicts**: Your action won't interfere with other workflows
3. **Automatic cleanup**: The entire runner (with all files, processes, services) is discarded
4. **Simpler code**: No need for complex cleanup logic that might fail

This is the recommended approach for GitHub Actions that modify the system. The cleanup complexity in v3.x was unnecessary for the target environment.

### Key Insights for AI Agents

1. **Simplicity wins**: A 156-line bash script is easier to understand and maintain than hundreds of lines of TypeScript with state management

2. **Know your environment**: GitHub Actions runners are ephemeral, so cleanup is automatic

3. **No compilation = faster development**: Direct script execution means no build step

4. **Composite actions are powerful**: They can run shell scripts directly without Node.js

5. **Transparency**: Anyone can read the bash script and understand exactly what it does

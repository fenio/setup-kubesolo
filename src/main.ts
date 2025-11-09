import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { promises as fs } from 'fs';

export async function main(): Promise<void> {
  try {
    core.info('Starting KubeSolo setup...');
    
    // Set state to indicate this is not post-run
    core.saveState('isPost', 'true');
    
    // Get inputs
    const version = core.getInput('version') || 'latest';
    const waitForReady = core.getInput('wait-for-ready') === 'true';
    const timeout = parseInt(core.getInput('timeout') || '60', 10);
    
    core.info(`Configuration: version=${version}, wait-for-ready=${waitForReady}, timeout=${timeout}s`);
    
    // Step 1: Disable conflicting container runtimes
    await disableContainerRuntimes();
    
    // Step 2: Install KubeSolo
    await installKubeSolo(version);
    
    // Step 3: Wait for cluster ready (if requested)
    if (waitForReady) {
      await waitForClusterReady(timeout);
    }
    
    core.info('✓ KubeSolo setup completed successfully!');
  } catch (error) {
    throw error;
  }
}

async function disableContainerRuntimes(): Promise<void> {
  core.startGroup('Disabling conflicting container runtimes');
  
  try {
    core.info('Stopping container runtime services...');
    
    // Stop and mask all container runtime services
    const services = ['docker.socket', 'docker', 'containerd', 'podman'];
    for (const service of services) {
      await exec.exec('sudo', ['systemctl', 'stop', service], { ignoreReturnCode: true });
      await exec.exec('sudo', ['systemctl', 'mask', service], { ignoreReturnCode: true });
    }
    
    // Backup runtime binaries
    const binaries = ['docker', 'dockerd', 'containerd', 'containerd-shim', 'containerd-shim-runc-v2', 'runc', 'podman'];
    for (const binary of binaries) {
      const binaryPath = `/usr/bin/${binary}`;
      try {
        await fs.access(binaryPath);
        await exec.exec('sudo', ['mv', binaryPath, `${binaryPath}.bak`], { ignoreReturnCode: true });
        core.info(`  Backed up ${binary}`);
      } catch {
        // Binary doesn't exist, skip
      }
    }
    
    // Clean up runtime sockets
    await exec.exec('sudo', ['rm', '-rf', '/var/run/docker*', '/var/run/containerd', '/run/containerd', '/run/docker*'], { ignoreReturnCode: true });
    
    core.info('✓ Container runtimes disabled');
  } catch (error) {
    throw new Error(`Failed to disable container runtimes: ${error}`);
  } finally {
    core.endGroup();
  }
}

async function installKubeSolo(version: string): Promise<void> {
  core.startGroup('Installing KubeSolo');
  
  try {
    core.info(`Installing KubeSolo ${version}...`);
    
    // Resolve version if 'latest'
    let actualVersion = version;
    if (version === 'latest') {
      core.info('Resolving latest version...');
      const versionOutput: string[] = [];
      await exec.exec('bash', ['-c', 'curl -sL https://api.github.com/repos/portainer/kubesolo/releases/latest | grep \'"tag_name"\' | cut -d\'"\' -f4'], {
        listeners: {
          stdout: (data: Buffer) => versionOutput.push(data.toString())
        }
      });
      actualVersion = versionOutput.join('').trim();
      core.info(`  Latest version: ${actualVersion}`);
    }
    
    // Detect architecture
    const archOutput: string[] = [];
    await exec.exec('uname', ['-m'], {
      listeners: {
        stdout: (data: Buffer) => archOutput.push(data.toString())
      }
    });
    const arch = archOutput.join('').trim();
    
    // Map architecture to binary name
    let binaryArch: string;
    switch (arch) {
      case 'x86_64':
        binaryArch = 'amd64';
        break;
      case 'aarch64':
        binaryArch = 'arm64';
        break;
      case 'armv7l':
        binaryArch = 'arm';
        break;
      default:
        throw new Error(`Unsupported architecture: ${arch}`);
    }
    
    core.info(`  Architecture: ${arch} -> ${binaryArch}`);
    
    // Download binary
    const downloadUrl = `https://github.com/portainer/kubesolo/releases/download/${actualVersion}/kubesolo-${actualVersion}-linux-${binaryArch}.tar.gz`;
    core.info(`  Downloading from: ${downloadUrl}`);
    
    await exec.exec('curl', ['-sfL', downloadUrl, '-o', '/tmp/kubesolo.tar.gz']);
    
    // Extract binary
    core.info('  Extracting binary...');
    await exec.exec('tar', ['-xzf', '/tmp/kubesolo.tar.gz', '-C', '/tmp']);
    
    // Install binary
    core.info('  Installing binary to /usr/local/bin/kubesolo...');
    await exec.exec('sudo', ['mv', '/tmp/kubesolo', '/usr/local/bin/kubesolo']);
    await exec.exec('sudo', ['chmod', '+x', '/usr/local/bin/kubesolo']);
    
    // Create data directory
    await exec.exec('sudo', ['mkdir', '-p', '/var/lib/kubesolo']);
    
    // Create systemd service
    core.info('  Creating systemd service...');
    const serviceContent = `[Unit]
Description=KubeSolo - Lightweight Kubernetes
Documentation=https://github.com/portainer/kubesolo
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
Restart=on-failure
RestartSec=5s
ExecStart=/usr/local/bin/kubesolo --path=/var/lib/kubesolo
KillMode=process
Delegate=yes
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity

[Install]
WantedBy=multi-user.target
`;
    
    await exec.exec('bash', ['-c', `echo '${serviceContent}' | sudo tee /etc/systemd/system/kubesolo.service > /dev/null`]);
    
    // Reload systemd and start service
    core.info('  Starting KubeSolo service...');
    await exec.exec('sudo', ['systemctl', 'daemon-reload']);
    await exec.exec('sudo', ['systemctl', 'enable', 'kubesolo']);
    await exec.exec('sudo', ['systemctl', 'start', 'kubesolo']);
    
    // Clean up
    await exec.exec('rm', ['-f', '/tmp/kubesolo.tar.gz']);
    
    // Wait a moment for kubeconfig to be generated
    core.info('  Waiting for kubeconfig generation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Export KUBECONFIG path for subsequent steps
    const kubeconfigPath = '/var/lib/kubesolo/pki/admin/admin.kubeconfig';
    
    // Make kubeconfig accessible
    await exec.exec('sudo', ['chmod', '644', kubeconfigPath], { 
      ignoreReturnCode: true,
      silent: true 
    });
    
    // Set output and export environment variable
    core.setOutput('kubeconfig', kubeconfigPath);
    core.exportVariable('KUBECONFIG', kubeconfigPath);
    core.info(`  KUBECONFIG exported: ${kubeconfigPath}`);
    
    core.info('✓ KubeSolo installed successfully');
  } catch (error) {
    throw new Error(`Failed to install KubeSolo: ${error}`);
  } finally {
    core.endGroup();
  }
}

async function waitForClusterReady(timeoutSeconds: number): Promise<void> {
  core.startGroup('Waiting for cluster ready');
  
  try {
    core.info(`Waiting for KubeSolo cluster to be ready (timeout: ${timeoutSeconds}s)...`);
    
    const startTime = Date.now();
    const kubeconfigPath = '/var/lib/kubesolo/pki/admin/admin.kubeconfig';
    
    while (true) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      if (elapsed > timeoutSeconds) {
        core.error('Timeout waiting for cluster to be ready');
        await showDiagnostics();
        throw new Error('Timeout waiting for cluster to be ready');
      }
      
      // Check if KubeSolo service is active
      const serviceResult = await exec.exec('sudo', ['systemctl', 'is-active', 'kubesolo'], { 
        ignoreReturnCode: true,
        silent: true 
      });
      
      if (serviceResult === 0) {
        core.info('  KubeSolo service is active');
        
        // Check if API server port is listening
        const portResult = await exec.exec('bash', ['-c', 'ss -tlnp 2>/dev/null | grep -q ":6443 "'], { 
          ignoreReturnCode: true,
          silent: true 
        });
        
        if (portResult === 0) {
          core.info('  API server is listening on port 6443');
          
          // Check if kubeconfig exists and is accessible
          try {
            await fs.access(kubeconfigPath);
            core.info('  Kubeconfig file exists');
            
            // Make kubeconfig accessible
            await exec.exec('sudo', ['chmod', '644', kubeconfigPath], { 
              ignoreReturnCode: true,
              silent: true 
            });
            
            // Verify kubectl can connect to API server
            const kubectlResult = await exec.exec('kubectl', ['--kubeconfig', kubeconfigPath, 'get', 'nodes', '--no-headers'], {
              ignoreReturnCode: true,
              silent: true
            });
            
            if (kubectlResult === 0) {
              core.info('  kubectl can connect to API server');
              
              // Verify node is Ready
              const nodeReady = await exec.exec('bash', ['-c', 
                `kubectl --kubeconfig ${kubeconfigPath} get nodes --no-headers | grep -q " Ready "`
              ], {
                ignoreReturnCode: true,
                silent: true
              });
              
              if (nodeReady === 0) {
                core.info('  Node is Ready');
                
                // Re-export KUBECONFIG to ensure it's set (already exported in installKubeSolo)
                core.setOutput('kubeconfig', kubeconfigPath);
                core.exportVariable('KUBECONFIG', kubeconfigPath);
                core.info(`  KUBECONFIG confirmed: ${kubeconfigPath}`);
                
                break;
              } else {
                core.info('  Node not Ready yet');
              }
            } else {
              core.info('  kubectl cannot connect yet');
            }
          } catch {
            core.info('  Kubeconfig not accessible yet');
          }
        }
      }
      
      core.info(`  Cluster not ready yet, waiting... (${elapsed}/${timeoutSeconds}s)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    core.info('✓ KubeSolo cluster is fully ready!');
  } catch (error) {
    throw new Error(`Failed waiting for cluster: ${error}`);
  } finally {
    core.endGroup();
  }
}

async function showDiagnostics(): Promise<void> {
  core.startGroup('Diagnostic Information');
  
  try {
    core.info('=== KubeSolo Service Status ===');
    await exec.exec('sudo', ['systemctl', 'status', 'kubesolo'], { ignoreReturnCode: true });
    
    core.info('=== KubeSolo Logs (last 100 lines) ===');
    await exec.exec('sudo', ['journalctl', '-u', 'kubesolo', '-n', '100', '--no-pager'], { ignoreReturnCode: true });
    
    core.info('=== Kubeconfig Directory ===');
    await exec.exec('ls', ['-laR', '/var/lib/kubesolo/pki/'], { ignoreReturnCode: true });
    
    core.info('=== Listening Ports ===');
    await exec.exec('sudo', ['ss', '-tlnp'], { ignoreReturnCode: true });
    
    core.info('=== Network Interfaces ===');
    await exec.exec('ip', ['addr'], { ignoreReturnCode: true });
  } catch (error) {
    core.warning(`Failed to gather diagnostics: ${error}`);
  } finally {
    core.endGroup();
  }
}

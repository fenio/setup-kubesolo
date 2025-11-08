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
    
    // Download and execute installer script
    let installCmd: string;
    if (version === 'latest') {
      installCmd = 'curl -sfL https://get.kubesolo.io | sudo sh -';
    } else {
      installCmd = `curl -sfL https://get.kubesolo.io | INSTALL_KUBESOLO_VERSION="${version}" sudo sh -`;
    }
    
    await exec.exec('bash', ['-c', installCmd]);
    
    // Set kubeconfig path output
    const kubeconfigPath = '/var/lib/kubesolo/pki/admin/admin.kubeconfig';
    core.setOutput('kubeconfig', kubeconfigPath);
    
    // Make kubeconfig accessible
    await exec.exec('sudo', ['chmod', '644', kubeconfigPath]);
    
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
    
    while (true) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      if (elapsed > timeoutSeconds) {
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
          break;
        }
      }
      
      core.info(`  Cluster not ready yet, waiting... (${elapsed}/${timeoutSeconds}s)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    core.info('✓ KubeSolo cluster is ready!');
  } catch (error) {
    throw new Error(`Failed waiting for cluster: ${error}`);
  } finally {
    core.endGroup();
  }
}

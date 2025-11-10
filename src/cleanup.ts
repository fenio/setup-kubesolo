import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { promises as fs } from 'fs';

export async function cleanup(): Promise<void> {
  core.startGroup('Cleaning up and restoring system state');
  
  try {
    core.info('Starting cleanup...');
    
    // Stop and uninstall KubeSolo
    await stopKubeSolo();
    
    // Restore container runtime binaries
    await restoreContainerRuntimes();
    
    // Unmask and restart services
    await restoreServices();
    
    core.info('✓ System state restored');
  } catch (error) {
    core.warning(`Cleanup encountered errors: ${error}`);
    // Don't fail the workflow if cleanup has issues
  } finally {
    core.endGroup();
  }
}

async function stopKubeSolo(): Promise<void> {
  core.info('Stopping KubeSolo...');
  
  // Check if service exists and is active
  const isActive = await exec.exec('sudo', ['systemctl', 'is-active', 'kubesolo'], { 
    ignoreReturnCode: true,
    silent: true 
  });
  
  if (isActive === 0) {
    await exec.exec('sudo', ['systemctl', 'stop', 'kubesolo'], { ignoreReturnCode: true });
    core.info('  Stopped KubeSolo service');
  }
  
  // Disable service if enabled
  const isEnabled = await exec.exec('sudo', ['systemctl', 'is-enabled', 'kubesolo'], { 
    ignoreReturnCode: true,
    silent: true 
  });
  
  if (isEnabled === 0) {
    await exec.exec('sudo', ['systemctl', 'disable', 'kubesolo'], { ignoreReturnCode: true });
    core.info('  Disabled KubeSolo service');
  }
  
  // Force kill any remaining KubeSolo processes
  core.info('  Ensuring all KubeSolo processes are terminated...');
  await exec.exec('sudo', ['systemctl', 'kill', '--signal=SIGKILL', 'kubesolo'], { 
    ignoreReturnCode: true, 
    silent: true 
  });
  
  // Wait for port 6443 to be released - CRITICAL for subsequent k8s distributions
  core.info('  Waiting for port 6443 to be released...');
  const portReleaseTimeout = 30; // seconds
  const portReleaseStart = Date.now();
  let portReleased = false;
  
  while (Date.now() - portReleaseStart < portReleaseTimeout * 1000) {
    const portCheck = await exec.exec('bash', ['-c', 'ss -tlnp 2>/dev/null | grep -q ":6443 "'], {
      ignoreReturnCode: true,
      silent: true
    });
    
    if (portCheck !== 0) {
      // Port is no longer in use
      portReleased = true;
      core.info('  Port 6443 is now free');
      break;
    }
    
    // Port still in use, wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!portReleased) {
    core.warning('  Port 6443 may still be in use after 30s - this could cause issues for subsequent k8s distributions');
    // Show what's using the port for debugging
    await exec.exec('bash', ['-c', 'ss -tlnp 2>/dev/null | grep ":6443" || true'], {
      ignoreReturnCode: true,
      silent: false
    });
  }
  
  // Give an additional moment for any remaining cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Unmount all KubeSolo-related mount points (critical for cleanup)
  core.info('  Unmounting KubeSolo filesystems...');
  
  // Find and unmount all mounts under /var/lib/kubesolo (in reverse order, deepest first)
  const mounts: string[] = [];
  await exec.exec('bash', ['-c', 'mount | grep /var/lib/kubesolo | awk \'{print $3}\' | sort -r || true'], {
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        const lines = data.toString().trim().split('\n').filter(line => line);
        mounts.push(...lines);
      }
    }
  });
  
  if (mounts.length > 0) {
    core.info(`  Found ${mounts.length} mount points to unmount`);
    for (const mount of mounts) {
      await exec.exec('sudo', ['umount', '-f', mount], { 
        ignoreReturnCode: true, 
        silent: true 
      });
    }
    core.info('  All mount points unmounted');
  }
  
  core.info('  All KubeSolo processes terminated and mounts cleaned');
  
  // Remove KubeSolo files and directories one by one for better error visibility
  const filesToRemove = [
    '/var/lib/kubesolo',
    '/usr/local/bin/kubesolo',
    '/etc/systemd/system/kubesolo.service',
    '/opt/cni',
    '/var/lib/cni',
    '/etc/cni',
    '/var/log/pods',
    '/var/log/containers'
  ];
  
  for (const file of filesToRemove) {
    let stderr = '';
    const result = await exec.exec('sudo', ['rm', '-rf', file], { 
      ignoreReturnCode: true, 
      silent: true,
      listeners: {
        stderr: (data: Buffer) => {
          stderr += data.toString();
        }
      }
    });
    if (result === 0) {
      core.info(`  Removed ${file}`);
    } else {
      core.warning(`  Failed to remove ${file}: ${stderr.trim() || 'unknown error'}`);
    }
  }
  
  await exec.exec('sudo', ['systemctl', 'daemon-reload'], { ignoreReturnCode: true });
  
  core.info('  KubeSolo cleanup complete');
}

async function restoreContainerRuntimes(): Promise<void> {
  core.info('Restoring container runtime binaries...');
  
  const binaries = ['docker', 'dockerd', 'containerd', 'containerd-shim', 'containerd-shim-runc-v2', 'runc', 'podman'];
  
  for (const binary of binaries) {
    const backupPath = `/usr/bin/${binary}.bak`;
    const originalPath = `/usr/bin/${binary}`;
    
    try {
      await fs.access(backupPath);
      await exec.exec('sudo', ['mv', backupPath, originalPath], { ignoreReturnCode: true });
      core.info(`  Restored ${binary}`);
    } catch {
      // Backup doesn't exist, skip
    }
  }
}

async function restoreServices(): Promise<void> {
  core.info('Restoring container runtime services...');
  
  const services = ['docker.socket', 'docker', 'containerd', 'podman'];
  
  // Unmask all services first
  core.info('  Unmasking services...');
  for (const service of services) {
    const result = await exec.exec('sudo', ['systemctl', 'unmask', service], { 
      ignoreReturnCode: true,
      silent: false  // Show output for debugging
    });
    if (result === 0) {
      core.info(`    Unmasked ${service}`);
    }
  }
  
  // Reload systemd to pick up changes - CRITICAL after unmasking
  core.info('  Reloading systemd daemon...');
  await exec.exec('sudo', ['systemctl', 'daemon-reload'], { 
    ignoreReturnCode: true,
    silent: false 
  });
  
  // Try to start services - systemctl will skip if they don't exist
  core.info('  Starting services...');
  for (const service of services) {
    const result = await exec.exec('sudo', ['systemctl', 'start', service], { 
      ignoreReturnCode: true,
      silent: false  // Show output for debugging
    });
    
    if (result === 0) {
      // Verify it's actually running
      const isActive = await exec.exec('sudo', ['systemctl', 'is-active', service], { 
        ignoreReturnCode: true,
        silent: true 
      });
      
      if (isActive === 0) {
        core.info(`    ${service} is active and running`);
      } else {
        core.warning(`    ${service} started but is not active - may not be installed`);
      }
    } else {
      core.warning(`    Failed to start ${service} - may not be installed`);
    }
  }
  
  core.info('  Service restoration complete');
}

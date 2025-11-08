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
  
  // Remove KubeSolo files one by one for better error visibility
  const filesToRemove = [
    '/var/lib/kubesolo',
    '/usr/local/bin/kubesolo',
    '/etc/systemd/system/kubesolo.service'
  ];
  
  for (const file of filesToRemove) {
    const result = await exec.exec('sudo', ['rm', '-rf', file], { ignoreReturnCode: true, silent: true });
    if (result === 0) {
      core.info(`  Removed ${file}`);
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
  for (const service of services) {
    await exec.exec('sudo', ['systemctl', 'unmask', service], { ignoreReturnCode: true, silent: true });
  }
  
  core.info('  Unmasked services');
  
  // Reload systemd to pick up changes
  await exec.exec('sudo', ['systemctl', 'daemon-reload'], { ignoreReturnCode: true, silent: true });
  
  // Try to start services - systemctl will skip if they don't exist
  for (const service of services) {
    const result = await exec.exec('sudo', ['systemctl', 'start', service], { 
      ignoreReturnCode: true,
      silent: true 
    });
    
    if (result === 0) {
      core.info(`  Started ${service}`);
      
      // Verify it's actually running
      const isActive = await exec.exec('sudo', ['systemctl', 'is-active', service], { 
        ignoreReturnCode: true,
        silent: true 
      });
      
      if (isActive !== 0) {
        core.warning(`  ${service} started but not active - may not have been installed`);
      }
    }
  }
}

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
  
  // Remove KubeSolo files
  await exec.exec('sudo', ['rm', '-rf', '/var/lib/kubesolo', '/usr/local/bin/kubesolo', '/etc/systemd/system/kubesolo.service'], { ignoreReturnCode: true });
  await exec.exec('sudo', ['systemctl', 'daemon-reload'], { ignoreReturnCode: true });
  
  core.info('  Removed KubeSolo files');
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
  
  // Unmask services
  for (const service of services) {
    await exec.exec('sudo', ['systemctl', 'unmask', service], { ignoreReturnCode: true });
  }
  
  core.info('  Unmasked services');
  
  // Try to restart services that exist
  for (const service of services) {
    const exists = await exec.exec('bash', ['-c', `systemctl list-unit-files | grep -q "^${service}"`], { 
      ignoreReturnCode: true,
      silent: true 
    });
    
    if (exists === 0) {
      await exec.exec('sudo', ['systemctl', 'start', service], { ignoreReturnCode: true, silent: true });
      core.info(`  Restarted ${service}`);
    }
  }
}

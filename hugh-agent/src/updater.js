const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Runs a self-repair or update script sent by H.U.G.H.
 */
function runUpdate(script) {
  return new Promise((resolve) => {
    // Create a temporary script file
    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `hugh-update-${Date.now()}.sh`);
    
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');

    console.log(`[hugh-agent] Running update script: ${scriptPath}`);

    exec(
      scriptPath,
      {
        timeout: 120000, // 2 mins for updates
        shell: process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash',
      },
      (err, stdout, stderr) => {
        // Clean up
        try { fs.unlinkSync(scriptPath); } catch (e) {}

        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: err ? (err.code || 1) : 0,
          success: !err
        });
      }
    );
  });
}

module.exports = { runUpdate };

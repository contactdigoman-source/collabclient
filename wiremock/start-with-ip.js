#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');

// Get network IP address
function getNetworkIP() {
  const ifaces = os.networkInterfaces();
  let ip = 'localhost';
  
  Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        ip = iface.address;
      }
    });
  });
  
  return ip;
}

// Start WireMock
const wiremock = spawn('wiremock', [
  '--port', '8080',
  '--root-dir', '.',
  '--global-response-templating',
  '--verbose',
  '--bind-address', '0.0.0.0'
], {
  stdio: 'inherit',
  shell: true
});

// Wait a bit for WireMock to start, then print IP
setTimeout(() => {
  const ip = getNetworkIP();
  console.log('\n✅ WireMock is running!\n');
  console.log('📍 Access URLs:');
  console.log('   Local:    http://localhost:8080');
  console.log('   Network:  http://' + ip + ':8080');
  console.log('   Admin:    http://' + ip + ':8080/__admin\n');
}, 3000);

// Handle process exit
wiremock.on('exit', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  wiremock.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  wiremock.kill('SIGTERM');
  process.exit(0);
});


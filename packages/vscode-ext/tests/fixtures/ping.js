process.stdout.write('ping');
process.stdin.on('data', (d) => {
  if (d.toString().trim() === 'pong') {
    process.stderr.write('ok');
    process.exit(0);
  }
});

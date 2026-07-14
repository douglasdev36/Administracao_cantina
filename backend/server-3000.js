import { createServer } from 'http';

const server = createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Server is running on port 3000', timestamp: new Date().toISOString() }));
});

server.listen(3000, () => {
  console.log('🚀 HTTP server running at http://localhost:3000');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
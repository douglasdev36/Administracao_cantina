import express from 'express';
const app = express();
const PORT = 4000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  const { email, password } = req.body;
  
  if (email === 'superadmin@cantina.com' && password === '123456') {
    return res.json({ 
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      user: { 
        id: '1', 
        email: 'superadmin@cantina.com', 
        full_name: 'Super Administrador', 
        role: 'super_admin' 
      } 
    });
  }
  
  res.status(401).json({ error: 'Credenciais inválidas' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('Test: curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"superadmin@cantina.com\",\"password\":\"123456\"}"');
});

// Handle errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
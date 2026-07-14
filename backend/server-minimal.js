import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
const PORT = 4000;

// Simplified DB config for testing
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cantina_verde',
  user: 'cantina_user',
  password: 'cantina_password'
});

app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: false }));
app.use(express.json());

// Simple test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

// Simple login route
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha obrigatórios' });
    }
    
    // Test with hardcoded user first
    if (email === 'superadmin@cantina.com' && password === '123456') {
      const token = jwt.sign(
        { user_id: 'test-id', email: 'superadmin@cantina.com', role: 'super_admin' },
        'dev_secret_change_me',
        { expiresIn: '8h' }
      );
      return res.json({ 
        token, 
        user: { 
          id: 'test-id', 
          email: 'superadmin@cantina.com', 
          full_name: 'Super Administrador', 
          role: 'super_admin' 
        } 
      });
    }
    
    res.status(401).json({ error: 'Credenciais inválidas' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log('Test login: superadmin@cantina.com / 123456');
});
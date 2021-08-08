const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  port: 5432,
  password: 'admin',
  database: 'MrCoffeeDB'
});

pool.on('connect', () => {
  console.log('Database connection');
});

module.exports = pool;

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres', //  utilisateur PostgreSQL
  host: 'localhost',
  database: 'skillhub', // Le nom de La base
  password: 'Srima2019', // mot de passe PostgreSQL
  port: 5432, // Port par défaut de PostgreSQL
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connecté avec succès !'))
  .catch(err => console.error('❌ Erreur de connexion à PostgreSQL', err));

module.exports = pool;

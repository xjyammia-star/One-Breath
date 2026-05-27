// api/_lib/db.js
const { Pool } = require('pg')

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return pool
}

module.exports = { getPool }

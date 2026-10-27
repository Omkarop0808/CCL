import dotenv from 'dotenv';
dotenv.config();

import { loadAwsSecrets } from '../services/awsSecrets.js';
import { getRdsPool, isRdsEnabled } from '../services/rdsClient.js';

async function main() {
  console.log('\n=============================================================');
  console.log('       AMAZON RDS POSTGRESQL LIVE QUERY (sahaya_db)          ');
  console.log('=============================================================\n');

  // Load secrets from AWS Systems Manager Parameter Store
  await loadAwsSecrets();

  if (!isRdsEnabled()) {
    console.log('❌ RDS is not enabled or credentials missing.');
    process.exit(1);
  }

  const pool = getRdsPool();
  try {
    const counts = await pool.query(`
      SELECT collection, count(*) as count 
      FROM app_data_rows 
      GROUP BY collection 
      ORDER BY count DESC
    `);
    console.log('📊 Table Collections Summary in Amazon RDS:');
    console.table(counts.rows);

    const users = await pool.query(`
      SELECT 
        row_id, 
        payload->>'name' as name, 
        payload->>'email' as email, 
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as registered_at
      FROM app_data_rows 
      WHERE collection = 'users' 
      ORDER BY updated_at DESC 
      LIMIT 10
    `);
    console.log('\n👥 Recent Registered Users in Amazon RDS:');
    console.table(users.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error querying RDS:', err.message);
    process.exit(1);
  }
}

main();

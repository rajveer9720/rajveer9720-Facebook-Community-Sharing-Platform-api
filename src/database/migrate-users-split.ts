import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Admin } from '../admins/admin.entity';
import { Worker } from '../workers/worker.entity';

dotenv.config();

const SHARED_COLUMNS =
  'id, email, passwordHash, refreshTokenHash, passwordResetTokenHash, passwordResetTokenExpiresAt, firstName, lastName, createdAt, updatedAt';

async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'facebook-sharing',
    entities: [Admin, Worker],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Connected. `admins` and `workers` tables created/verified from entity definitions.');

  const legacyTable: unknown[] = await dataSource.query("SHOW TABLES LIKE 'users'");
  if (legacyTable.length === 0) {
    console.log('No legacy `users` table found — nothing to migrate.');
    await dataSource.destroy();
    return;
  }

  const [beforeAdmins] = await dataSource.query("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'");
  const [beforeWorkers] = await dataSource.query("SELECT COUNT(*) as count FROM users WHERE role = 'WORKER'");

  await dataSource.query(
    `INSERT INTO admins (${SHARED_COLUMNS}) SELECT ${SHARED_COLUMNS} FROM users WHERE role = 'ADMIN' ON DUPLICATE KEY UPDATE id = VALUES(id)`,
  );
  await dataSource.query(
    `INSERT INTO workers (${SHARED_COLUMNS}) SELECT ${SHARED_COLUMNS} FROM users WHERE role = 'WORKER' ON DUPLICATE KEY UPDATE id = VALUES(id)`,
  );

  const [maxAdminId] = await dataSource.query('SELECT COALESCE(MAX(id), 0) as maxId FROM admins');
  await dataSource.query(`ALTER TABLE admins AUTO_INCREMENT = ${Number(maxAdminId.maxId) + 1}`);
  const [maxWorkerId] = await dataSource.query('SELECT COALESCE(MAX(id), 0) as maxId FROM workers');
  await dataSource.query(`ALTER TABLE workers AUTO_INCREMENT = ${Number(maxWorkerId.maxId) + 1}`);

  const [afterAdmins] = await dataSource.query('SELECT COUNT(*) as count FROM admins');
  const [afterWorkers] = await dataSource.query('SELECT COUNT(*) as count FROM workers');

  console.log(`admins: ${beforeAdmins.count} (users, role=ADMIN) -> ${afterAdmins.count} (admins table)`);
  console.log(`workers: ${beforeWorkers.count} (users, role=WORKER) -> ${afterWorkers.count} (workers table)`);

  if (Number(beforeAdmins.count) !== Number(afterAdmins.count) || Number(beforeWorkers.count) !== Number(afterWorkers.count)) {
    console.error('Row count mismatch — do not proceed until this is resolved.');
    await dataSource.destroy();
    process.exitCode = 1;
    return;
  }

  console.log('Migration verified: row counts match.');
  console.log('The old `users` table was left untouched as a rollback safety net.');
  console.log('Once you have confirmed admin/worker logins work end-to-end, you can archive it manually with:');
  console.log(`  RENAME TABLE users TO users_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')};`);

  await dataSource.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import migrationRunner from "node-pg-migrate";
import { join } from "node:path";
import database from "infra/database.js";

export default async function migrations(request, response) {
  let databaseOpenedConnections = await getDatabaseOpenedConnections();
  console.log(`Conexões abertas no início: ${databaseOpenedConnections}`);
  const dbClient = await database.getNewClient();
  const defaultMigrationOptions = {
    dbClient: dbClient,
    dryRun: true,
    dir: join("infra", "migrations"),
    direction: "up",
    verbose: true,
    migrationsTable: "pgmigrations",
  };

  if (request.method === "GET") {
    const pendingMigrations = await migrationRunner(defaultMigrationOptions);
    await dbClient.end();
    databaseOpenedConnections = await getDatabaseOpenedConnections();
    console.log(`Conexões abertas GET no final: ${databaseOpenedConnections}`);
    return response.status(200).json(pendingMigrations);
  }

  if (request.method === "POST") {
    const migratedMigrations = await migrationRunner({
      ...defaultMigrationOptions,
      dryRun: false,
    });

    await dbClient.end();
    databaseOpenedConnections = await getDatabaseOpenedConnections();
    console.log(`Conexões abertas POST no final: ${databaseOpenedConnections}`);

    if (migratedMigrations.length > 0) {
      return response.status(201).json(migratedMigrations);
    }

    return response.status(200).json(migratedMigrations);
  }

  databaseOpenedConnections = await getDatabaseOpenedConnections();
  console.log(`Conexões abertas no final: ${databaseOpenedConnections}`);

  return response.status(405).end();
}

async function getDatabaseOpenedConnections() {
  const databaseName = process.env.POSTGRES_DB;
  const databaseOpenedConnectionsResult = await database.query({
    text: "SELECT count(*)::int FROM pg_stat_activity WHERE datname = $1;",
    values: [databaseName],
  });
  const databaseOpenedConnectionsValue =
    databaseOpenedConnectionsResult.rows[0].count;

  return databaseOpenedConnectionsValue;
}

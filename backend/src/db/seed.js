import bcrypt from "bcrypt";
import { pathToFileURL } from "node:url";
import { createPool } from "./client.js";
import { DEMO_ENTRIES, DEMO_LIST, DEMO_USER } from "./seed-data.js";

export async function seedDatabase() {
  const pool = createPool();

  if (!pool) {
    throw new Error("DATABASE_URL is required before running the seed script.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);
    const userResult = await client.query(
      `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            display_name = EXCLUDED.display_name
        RETURNING id
      `,
      [DEMO_USER.email, passwordHash, DEMO_USER.displayName]
    );
    const userId = userResult.rows[0].id;

    const existingListResult = await client.query(
      `
        SELECT id
        FROM lists
        WHERE owner_id = $1 AND name = $2
        LIMIT 1
      `,
      [userId, DEMO_LIST.name]
    );

    const listId =
      existingListResult.rows[0]?.id ??
      (
        await client.query(
          `
            INSERT INTO lists (name, owner_id)
            VALUES ($1, $2)
            RETURNING id
          `,
          [DEMO_LIST.name, userId]
        )
      ).rows[0].id;

    await client.query("DELETE FROM entries WHERE list_id = $1", [listId]);
    await client.query(
      `
        INSERT INTO entries (list_id, text, status)
        SELECT $1, entry_text, 'open'
        FROM unnest($2::text[]) AS seeded_entries(entry_text)
      `,
      [listId, DEMO_ENTRIES]
    );

    await client.query("COMMIT");

    return {
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      listName: DEMO_LIST.name,
      entryCount: DEMO_ENTRIES.length
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase()
    .then((result) => {
      console.log(
        `Seeded ${result.listName} for ${result.email} with ${result.entryCount} starter entries.`
      );
      console.log(`Demo password: ${result.password}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

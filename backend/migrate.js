require('dotenv').config();
const { Pool } = require('pg');

const runMigration = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Running migrations...');

    // Create pages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'Page 1',
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Pages table verified');

    // Create board_snapshots table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS board_snapshots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        canvas_state JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Board snapshots table verified');

    // Alter elements table to add page_id if it doesn't exist
    await pool.query(`
      ALTER TABLE elements 
      ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES pages(id) ON DELETE CASCADE;
    `);
    console.log('✅ Elements table altered');

    // Alter boards table to add thumbnail
    await pool.query(`
      ALTER TABLE boards 
      ADD COLUMN IF NOT EXISTS thumbnail TEXT;
    `);
    console.log('✅ Boards table altered');

    // Create default pages for existing boards that don't have pages
    const boards = await pool.query('SELECT id FROM boards');
    for (const board of boards.rows) {
      const existingPages = await pool.query('SELECT id FROM pages WHERE board_id = $1', [board.id]);
      if (existingPages.rows.length === 0) {
        const pageResult = await pool.query(
          'INSERT INTO pages (board_id, title, order_index) VALUES ($1, $2, $3) RETURNING id',
          [board.id, 'Page 1', 0]
        );
        const newPageId = pageResult.rows[0].id;
        // Assign existing elements without a page to this new page
        await pool.query('UPDATE elements SET page_id = $1 WHERE board_id = $2 AND page_id IS NULL', [newPageId, board.id]);
      }
    }
    console.log('✅ Default pages created and elements updated');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
};

runMigration();

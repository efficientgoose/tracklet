use rusqlite::{Connection, Result};
use std::path::Path;

pub const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_init.sql");

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(Self { conn })
    }

    pub fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(INITIAL_MIGRATION)
    }
}

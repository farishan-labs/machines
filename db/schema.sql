CREATE TABLE machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            host TEXT NOT NULL DEFAULT '',
            hardware_model TEXT NOT NULL DEFAULT '',
            hardware_vendor TEXT NOT NULL DEFAULT '',
            processor TEXT NOT NULL DEFAULT '',
            memory TEXT NOT NULL DEFAULT '',
            graphics TEXT NOT NULL DEFAULT '',
            disk_capacity TEXT NOT NULL DEFAULT '',
            os_name TEXT NOT NULL DEFAULT '',
            os_type TEXT NOT NULL DEFAULT '',
            gnome_version TEXT NOT NULL DEFAULT '',
            windowing_system TEXT NOT NULL DEFAULT '',
            kernel TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
CREATE TABLE sqlite_sequence(name,seq);

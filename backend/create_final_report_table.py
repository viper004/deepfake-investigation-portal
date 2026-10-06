import sqlalchemy as sa
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL", "mysql+pymysql://sentinel_user:sentinel_pass@localhost/sentinel_db")

engine = create_engine(db_url)

create_table_sql = """
CREATE TABLE IF NOT EXISTS final_case_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL UNIQUE,
    investigator_id INT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    sha256_hash VARCHAR(64),
    version INT DEFAULT 1,
    is_submitted BOOLEAN DEFAULT FALSE,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME DEFAULT NULL,
    FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (investigator_id) REFERENCES users(id) ON DELETE CASCADE
);
"""

with engine.connect() as conn:
    conn.execute(sa.text(create_table_sql))
    conn.commit()

print("Created final_case_reports table successfully.")

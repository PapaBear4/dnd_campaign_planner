import os
import sys
import tempfile
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Create a temporary test database before any modules import app.db.database
test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
test_db_path = test_db.name
test_db.close()
os.environ["DATABASE_PATH"] = test_db_path

import pytest
from app.db.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()
    yield
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass

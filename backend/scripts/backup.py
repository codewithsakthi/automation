import os
import subprocess
import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def run_backup():
    """
    Performs a database backup using pg_dump.
    Expects DATABASE_URL to be set in environment variables.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[-] Error: DATABASE_URL not found in environment variables.")
        return

    # Create backups directory if it doesn't exist
    backup_dir = os.path.join(os.getcwd(), "backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"spark_backup_{timestamp}.sql")
    
    print(f"[*] Starting backup to {backup_file}...")
    
    try:
        # pg_dump can take a connection string directly
        # Note: 'pg_dump' must be in the system PATH
        result = subprocess.run(
            ["pg_dump", db_url, "-f", backup_file, "-v"],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"[+] Backup completed successfully: {backup_file}")
    except subprocess.CalledProcessError as e:
        print(f"[-] Backup failed with exit code {e.returncode}")
        print(f"[-] Error output: {e.stderr}")
    except Exception as e:
        print(f"[-] An unexpected error occurred: {e}")

if __name__ == "__main__":
    run_backup()

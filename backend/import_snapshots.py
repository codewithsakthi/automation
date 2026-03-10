from app.database import SessionLocal
from app.scraper import PortalScraper


def main():
    db = SessionLocal()
    try:
        result = PortalScraper().import_all_snapshots(db)
        print(f"Imported: {result['imported_count']}")
        print(f"Errors: {result['error_count']}")
        for item in result['imported_students']:
            print(f"{item['roll_no']} | {item['username']} | {item['initial_password']}")
        if result['errors']:
            print('\nImport errors:')
            for item in result['errors']:
                print(f"{item['file_name']}: {item['error']}")
    finally:
        db.close()


if __name__ == '__main__':
    main()

import pymysql
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

print("=" * 60)
print("WAREHOUSE HOURS - DATABASE SETUP")
print("=" * 60)

# Get credentials from environment variables
timeout = 10

try:
    print("\n1. Connecting to Aiven MySQL...")
    connection = pymysql.connect(
        charset="utf8mb4",
        connect_timeout=timeout,
        cursorclass=pymysql.cursors.DictCursor,
        db=os.getenv('DB_NAME', 'defaultdb'),
        host=os.getenv('DB_HOST'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', 19640)),
        user=os.getenv('DB_USER')
    )
    print("   ✅ Connected successfully!")

except Exception as e:
    print(f"   ❌ Connection failed: {e}")
    print("\n⚠️  Make sure you have a .env file with:")
    print("   DB_HOST=your-host")
    print("   DB_PORT=your-port")
    print("   DB_USER=your-user")
    print("   DB_PASSWORD=your-password")
    print("   DB_NAME=your-database")
    exit(1)

try:
    with connection.cursor() as cursor:
        print("\n2. Creating warehouse_submissions table...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS warehouse_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            division VARCHAR(10) NOT NULL,
            submission_month INT NOT NULL,
            submission_year INT NOT NULL,
            warehouse_hours DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_submission (division, submission_month, submission_year),
            INDEX idx_division (division),
            INDEX idx_month_year (submission_month, submission_year)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
        
        cursor.execute(create_table_sql)
        print("   ✅ Table created/verified successfully!")
        
    connection.commit()
    print("\n3. Committing changes...")
    print("   ✅ Changes committed!")
    
    print("\n4. Verifying tables in database...")
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print(f"   Found {len(tables)} table(s):")
        for table in tables:
            table_name = list(table.values())[0]
            print(f"      - {table_name}")
            
    print("\n5. Verifying table structure...")
    with connection.cursor() as cursor:
        cursor.execute("DESCRIBE warehouse_submissions")
        columns = cursor.fetchall()
        print(f"   Table has {len(columns)} column(s):")
        for col in columns:
            print(f"      • {col['Field']:20} - {col['Type']:15}")
    
    print("\n6. Checking existing data...")
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) as count FROM warehouse_submissions")
        result = cursor.fetchone()
        count = result['count']
        print(f"   Current records in table: {count}")

except Exception as e:
    print(f"\n   ❌ Error: {e}")
    exit(1)

finally:
    connection.close()

print("\n" + "=" * 60)
print("✅ DATABASE SETUP COMPLETE!")
print("=" * 60)
print("\nYour database is ready to use!")
print("=" * 60)
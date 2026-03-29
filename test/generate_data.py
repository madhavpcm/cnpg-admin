import random
import string
import sys

def random_string(length=10):
    return ''.join(random.choices(string.ascii_lowercase, k=length))

def generate_random_table():
    table_name = f"test_{random_string(6)}"
    num_cols = random.randint(3, 7)
    
    cols = ["id SERIAL PRIMARY KEY"]
    col_names = []
    
    for i in range(num_cols):
        col_name = f"col_{i}_{random_string(4)}"
        col_names.append(col_name)
        col_type = random.choice(["TEXT", "INTEGER", "BOOLEAN", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"])
        cols.append(f"{col_name} {col_type}")
    
    create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} (\n    " + ",\n    ".join(cols) + "\n);"
    
    inserts = []
    num_rows = random.randint(10, 50)
    for _ in range(num_rows):
        vals = []
        for col_def in cols[1:]:
            col_type = col_def.split()[1]
            if col_type == "TEXT":
                vals.append(f"'{random_string(15)}'")
            elif col_type == "INTEGER":
                vals.append(str(random.randint(1, 10000)))
            elif col_type == "BOOLEAN":
                vals.append(random.choice(["TRUE", "FALSE"]))
            else:
                vals.append("CURRENT_TIMESTAMP")
        
        insert_sql = f"INSERT INTO {table_name} ({', '.join(col_names)}) VALUES ({', '.join(vals)});"
        inserts.append(insert_sql)
        
    return create_sql + "\n" + "\n".join(inserts)

if __name__ == "__main__":
    num_tables = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    print("-- Generated Random Data")
    for _ in range(num_tables):
        print("\n" + generate_random_table())

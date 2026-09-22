import os, sqlite3
from flask import Flask, request, jsonify, render_template, send_from_directory

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'shopping.db'))

CATEGORIES = ['ירקות ופירות', 'מוצרי חלב', 'דגים ובשר', 'שתייה', 'פיצוחים וחטיפים',
              'מוצרי ניקיון', 'טואלטיקה', 'מזווה', 'אחר']
STORES = ['רמי לוי', 'אושר עד', 'שופרסל', 'ויקטורי', 'קרפור', 'נטו חיסכון',
          'סופר 100', 'פאפא', 'כל חנות']
FREQUENCIES = ['weekly', 'occasional']


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS products (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        category   TEXT    NOT NULL DEFAULT 'אחר',
        store      TEXT    NOT NULL DEFAULT 'כל חנות',
        frequency  TEXT    NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('weekly','occasional')),
        barcode    TEXT,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS list_items (
        product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
        checked    INTEGER NOT NULL DEFAULT 0,
        added_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()


def ensure_weekly_items_on_list():
    conn = get_db()
    conn.execute('''INSERT INTO list_items (product_id)
                     SELECT p.id FROM products p
                     WHERE p.active = 1 AND p.frequency = 'weekly'
                       AND p.id NOT IN (SELECT product_id FROM list_items)''')
    conn.commit()
    conn.close()


@app.route('/')
def index():
    ensure_weekly_items_on_list()
    conn = get_db()
    rows = conn.execute('''SELECT p.*, li.checked FROM list_items li
                            JOIN products p ON p.id = li.product_id
                            WHERE p.active = 1
                            ORDER BY p.store, p.category, p.name''').fetchall()
    conn.close()
    grouped = {}
    for r in rows:
        grouped.setdefault(r['store'], {}).setdefault(r['category'], []).append(dict(r))
    return render_template('index.html', grouped=grouped, stores=STORES)


@app.route('/catalog')
def catalog():
    conn = get_db()
    rows = conn.execute('''SELECT * FROM products WHERE active = 1
                            ORDER BY store, category, name''').fetchall()
    conn.close()
    grouped = {}
    for r in rows:
        grouped.setdefault(r['store'], []).append(dict(r))
    return render_template('catalog.html', grouped=grouped, stores=STORES,
                            categories=CATEGORIES)


@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.get_json(force=True)
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    category = data.get('category') if data.get('category') in CATEGORIES else 'אחר'
    store = data.get('store') if data.get('store') in STORES else 'כל חנות'
    frequency = data.get('frequency') if data.get('frequency') in FREQUENCIES else 'weekly'
    conn = get_db()
    cur = conn.execute('''INSERT INTO products (name, category, store, frequency, barcode)
                           VALUES (?, ?, ?, ?, ?)''',
                        (name, category, store, frequency, data.get('barcode')))
    product_id = cur.lastrowid
    if frequency == 'weekly':
        conn.execute('INSERT OR IGNORE INTO list_items (product_id) VALUES (?)', (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'id': product_id})


@app.route('/api/products/<int:product_id>', methods=['POST'])
def update_product(product_id):
    data = request.get_json(force=True)
    fields, values = [], []
    if 'name' in data:
        fields.append('name = ?'); values.append(data['name'].strip())
    if data.get('category') in CATEGORIES:
        fields.append('category = ?'); values.append(data['category'])
    if data.get('store') in STORES:
        fields.append('store = ?'); values.append(data['store'])
    if data.get('frequency') in FREQUENCIES:
        fields.append('frequency = ?'); values.append(data['frequency'])
    if 'barcode' in data:
        fields.append('barcode = ?'); values.append(data['barcode'])
    if not fields:
        return jsonify({'error': 'nothing to update'}), 400
    values.append(product_id)
    conn = get_db()
    conn.execute(f'UPDATE products SET {", ".join(fields)} WHERE id = ?', values)
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/products/<int:product_id>/delete', methods=['POST'])
def delete_product(product_id):
    conn = get_db()
    conn.execute('UPDATE products SET active = 0 WHERE id = ?', (product_id,))
    conn.execute('DELETE FROM list_items WHERE product_id = ?', (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/list/toggle/<int:product_id>', methods=['POST'])
def toggle_item(product_id):
    conn = get_db()
    row = conn.execute('SELECT checked FROM list_items WHERE product_id = ?', (product_id,)).fetchone()
    new_val = 0 if row and row['checked'] else 1
    conn.execute('INSERT OR IGNORE INTO list_items (product_id) VALUES (?)', (product_id,))
    conn.execute('UPDATE list_items SET checked = ? WHERE product_id = ?', (new_val, product_id))
    conn.commit()
    conn.close()
    return jsonify({'checked': bool(new_val)})


@app.route('/api/list/add/<int:product_id>', methods=['POST'])
def add_to_list(product_id):
    conn = get_db()
    conn.execute('INSERT OR IGNORE INTO list_items (product_id) VALUES (?)', (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/list/remove/<int:product_id>', methods=['POST'])
def remove_from_list(product_id):
    conn = get_db()
    conn.execute('DELETE FROM list_items WHERE product_id = ?', (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/list/finish', methods=['POST'])
def finish_shopping():
    conn = get_db()
    conn.execute('DELETE FROM list_items')
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/sw.js')
def service_worker():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')


init_db()

if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5001)))

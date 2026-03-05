import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'demo.db');

// Remove existing demo db if present
import fs from 'fs';
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🌱 Seeding INTELLEXA-AI demo database...\n');

// ═══════════════════════════════════════
//  CREATE TABLES
// ═══════════════════════════════════════

db.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    price REAL NOT NULL,
    cost REAL NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_date TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    country TEXT DEFAULT 'USA',
    joined_date TEXT NOT NULL
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    total_amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
`);

console.log('✅ Tables created');

// ═══════════════════════════════════════
//  SEED DATA
// ═══════════════════════════════════════

const categories = [
    ['Electronics', 'Phones, laptops, tablets, and accessories'],
    ['Clothing', 'Men and women apparel, shoes, and accessories'],
    ['Home & Kitchen', 'Furniture, kitchenware, and home decor'],
    ['Sports & Outdoors', 'Equipment, apparel, and camping gear'],
    ['Books & Media', 'Books, e-books, music, and movies'],
    ['Health & Beauty', 'Skincare, supplements, and wellness products'],
    ['Toys & Games', 'Board games, video games, and kids toys'],
    ['Automotive', 'Car accessories, tools, and parts']
];

const insertCategory = db.prepare('INSERT INTO categories (category_name, description) VALUES (?, ?)');
for (const c of categories) insertCategory.run(...c);
console.log(`✅ ${categories.length} categories seeded`);

// Products - 40 realistic products
const products = [
    ['iPhone 15 Pro', 1, 999.99, 650, 120],
    ['Samsung Galaxy S24', 1, 849.99, 520, 95],
    ['MacBook Air M3', 1, 1299.99, 900, 60],
    ['iPad Pro 12.9"', 1, 1099.99, 700, 45],
    ['Sony WH-1000XM5', 1, 349.99, 180, 200],
    ['Nike Air Max 90', 2, 129.99, 45, 300],
    ['Levi\'s 501 Jeans', 2, 79.99, 25, 450],
    ['Adidas Ultraboost', 2, 179.99, 70, 220],
    ['North Face Jacket', 2, 249.99, 95, 150],
    ['Ray-Ban Aviator', 2, 159.99, 45, 180],
    ['KitchenAid Mixer', 3, 399.99, 200, 85],
    ['Dyson V15 Vacuum', 3, 749.99, 400, 55],
    ['Instant Pot Duo', 3, 89.99, 35, 400],
    ['Nespresso Machine', 3, 199.99, 90, 175],
    ['IKEA Desk Lamp', 3, 49.99, 15, 500],
    ['Yoga Mat Pro', 4, 69.99, 20, 350],
    ['Fitbit Charge 6', 4, 149.99, 65, 280],
    ['Coleman Tent 4P', 4, 199.99, 80, 90],
    ['Yeti Tumbler 30oz', 4, 34.99, 10, 600],
    ['Dumbbell Set 50lb', 4, 129.99, 45, 160],
    ['Atomic Habits', 5, 16.99, 4, 800],
    ['The Psychology of Money', 5, 14.99, 3, 650],
    ['Sapiens', 5, 18.99, 5, 550],
    ['Kindle Paperwhite', 5, 139.99, 70, 300],
    ['Spotify Premium Card', 5, 99.99, 85, 400],
    ['CeraVe Moisturizer', 6, 15.99, 4, 900],
    ['Vitamin D3 Supplement', 6, 12.99, 3, 700],
    ['Whey Protein 5lb', 6, 54.99, 22, 350],
    ['Electric Toothbrush', 6, 79.99, 30, 280],
    ['Sunscreen SPF 50', 6, 14.99, 4, 600],
    ['Nintendo Switch', 7, 299.99, 200, 110],
    ['LEGO Star Wars', 7, 149.99, 60, 200],
    ['PS5 DualSense', 7, 69.99, 35, 350],
    ['Monopoly Classic', 7, 24.99, 8, 450],
    ['Xbox Game Pass', 7, 59.99, 45, 500],
    ['Car Phone Mount', 8, 19.99, 5, 800],
    ['Dash Cam 4K', 8, 129.99, 45, 250],
    ['Tire Inflator', 8, 39.99, 15, 180],
    ['Car Vacuum', 8, 49.99, 18, 300],
    ['LED Headlights', 8, 89.99, 30, 220]
];

const insertProduct = db.prepare(
    'INSERT INTO products (product_name, category_id, price, cost, stock_quantity, created_date) VALUES (?, ?, ?, ?, ?, ?)'
);
const productDate = '2025-01-15';
for (const p of products) insertProduct.run(...p, productDate);
console.log(`✅ ${products.length} products seeded`);

// Customers - 30 customers from various regions
const firstNames = ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'Benjamin', 'Isabella',
    'Mason', 'Mia', 'Elijah', 'Charlotte', 'Lucas', 'Amelia', 'Henry', 'Harper', 'Alexander', 'Evelyn',
    'Daniel', 'Abigail', 'Michael', 'Emily', 'Ethan', 'Elizabeth', 'Sebastian', 'Sofia', 'Jack', 'Aria'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee',
    'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker'];
const cities = [
    ['New York', 'East'], ['Los Angeles', 'West'], ['Chicago', 'Central'], ['Houston', 'South'],
    ['Phoenix', 'West'], ['Philadelphia', 'East'], ['San Antonio', 'South'], ['San Diego', 'West'],
    ['Dallas', 'South'], ['Austin', 'South'], ['San Jose', 'West'], ['Jacksonville', 'East'],
    ['Fort Worth', 'South'], ['Columbus', 'Central'], ['Charlotte', 'East'], ['Indianapolis', 'Central'],
    ['San Francisco', 'West'], ['Seattle', 'West'], ['Denver', 'Central'], ['Boston', 'East'],
    ['Nashville', 'South'], ['Detroit', 'Central'], ['Portland', 'West'], ['Memphis', 'South'],
    ['Atlanta', 'South'], ['Miami', 'East'], ['Tampa', 'East'], ['Minneapolis', 'Central'],
    ['Raleigh', 'East'], ['Cleveland', 'Central']
];

const insertCustomer = db.prepare(
    'INSERT INTO customers (customer_name, email, city, region, joined_date) VALUES (?, ?, ?, ?, ?)'
);
for (let i = 0; i < 30; i++) {
    const name = `${firstNames[i]} ${lastNames[i]}`;
    const email = `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@email.com`;
    const [city, region] = cities[i];
    const joinMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const joinDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    insertCustomer.run(name, email, city, region, `2025-${joinMonth}-${joinDay}`);
}
console.log('✅ 30 customers seeded');

// Orders & Order Items — generate 500 realistic orders over 8 months
const insertOrder = db.prepare(
    'INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES (?, ?, ?, ?)'
);
const insertOrderItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)'
);
const insertPayment = db.prepare(
    'INSERT INTO payments (order_id, payment_date, amount, payment_method, status) VALUES (?, ?, ?, ?, ?)'
);

const statuses = ['completed', 'completed', 'completed', 'completed', 'shipped', 'processing', 'cancelled'];
const paymentMethods = ['credit_card', 'credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay'];

let orderCount = 0;
const orderInsert = db.transaction(() => {
    for (let month = 5; month <= 12; month++) {
        // Increasing orders each month for growth trend
        const ordersThisMonth = 40 + Math.floor(month * 8 + Math.random() * 15);

        for (let o = 0; o < ordersThisMonth; o++) {
            const customerId = Math.floor(Math.random() * 30) + 1;
            const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
            const orderDate = `2025-${String(month).padStart(2, '0')}-${day}`;
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            // 1–4 items per order
            const numItems = Math.floor(Math.random() * 4) + 1;
            let totalAmount = 0;
            const items = [];
            const usedProducts = new Set();

            for (let i = 0; i < numItems; i++) {
                let productId;
                do {
                    productId = Math.floor(Math.random() * 40) + 1;
                } while (usedProducts.has(productId));
                usedProducts.add(productId);

                const product = products[productId - 1];
                const qty = Math.floor(Math.random() * 3) + 1;
                const unitPrice = product[2];
                const subtotal = +(qty * unitPrice).toFixed(2);
                totalAmount += subtotal;
                items.push([productId, qty, unitPrice, subtotal]);
            }

            totalAmount = +totalAmount.toFixed(2);
            const result = insertOrder.run(customerId, orderDate, status, totalAmount);
            const orderId = result.lastInsertRowid;

            for (const item of items) {
                insertOrderItem.run(orderId, ...item);
            }

            // Payment for non-cancelled orders
            if (status !== 'cancelled') {
                const payMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
                insertPayment.run(orderId, orderDate, totalAmount, payMethod, 'completed');
            }

            orderCount++;
        }
    }
});

orderInsert();
console.log(`✅ ${orderCount} orders with items & payments seeded`);

// Add 2026 data for recent queries
const orderInsert2026 = db.transaction(() => {
    for (let month = 1; month <= 2; month++) {
        const ordersThisMonth = 90 + Math.floor(Math.random() * 20);
        for (let o = 0; o < ordersThisMonth; o++) {
            const customerId = Math.floor(Math.random() * 30) + 1;
            const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
            const orderDate = `2026-${String(month).padStart(2, '0')}-${day}`;
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            const numItems = Math.floor(Math.random() * 4) + 1;
            let totalAmount = 0;
            const items = [];
            const usedProducts = new Set();

            for (let i = 0; i < numItems; i++) {
                let productId;
                do {
                    productId = Math.floor(Math.random() * 40) + 1;
                } while (usedProducts.has(productId));
                usedProducts.add(productId);

                const product = products[productId - 1];
                const qty = Math.floor(Math.random() * 3) + 1;
                const unitPrice = product[2];
                const subtotal = +(qty * unitPrice).toFixed(2);
                totalAmount += subtotal;
                items.push([productId, qty, unitPrice, subtotal]);
            }

            totalAmount = +totalAmount.toFixed(2);
            const result = insertOrder.run(customerId, orderDate, status, totalAmount);
            const orderId = result.lastInsertRowid;

            for (const item of items) {
                insertOrderItem.run(orderId, ...item);
            }

            if (status !== 'cancelled') {
                const payMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
                insertPayment.run(orderId, orderDate, totalAmount, payMethod, 'completed');
            }

            orderCount++;
        }
    }
});

orderInsert2026();
console.log(`✅ 2026 orders added (total: ${orderCount})`);

// Final stats
const stats = {
    categories: db.prepare('SELECT COUNT(*) as c FROM categories').get().c,
    products: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
    customers: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
    orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    orderItems: db.prepare('SELECT COUNT(*) as c FROM order_items').get().c,
    payments: db.prepare('SELECT COUNT(*) as c FROM payments').get().c,
};

console.log('\n╔══════════════════════════════════════╗');
console.log('║   INTELLEXA-AI Demo DB Ready! 🚀    ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Categories   : ${String(stats.categories).padStart(6)}             ║`);
console.log(`║  Products     : ${String(stats.products).padStart(6)}             ║`);
console.log(`║  Customers    : ${String(stats.customers).padStart(6)}             ║`);
console.log(`║  Orders       : ${String(stats.orders).padStart(6)}             ║`);
console.log(`║  Order Items  : ${String(stats.orderItems).padStart(6)}             ║`);
console.log(`║  Payments     : ${String(stats.payments).padStart(6)}             ║`);
console.log('╚══════════════════════════════════════╝');

db.close();

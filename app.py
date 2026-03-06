import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, jsonify, session, flash
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-me-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'sqlite:///pizzeria.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class MenuItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300))
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)   # pizza / side / drink / dessert
    image = db.Column(db.String(200), default='default.jpg')
    available = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'category': self.category,
            'image': self.image,
            'available': self.available,
        }


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100), nullable=False)
    customer_email = db.Column(db.String(120), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    delivery_address = db.Column(db.String(300))
    order_type = db.Column(db.String(20), nullable=False)   # delivery / pickup
    status = db.Column(db.String(30), default='Received')   # Received / Preparing / Ready / Delivered
    total = db.Column(db.Float, nullable=False)
    notes = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'customer_email': self.customer_email,
            'customer_phone': self.customer_phone,
            'delivery_address': self.delivery_address,
            'order_type': self.order_type,
            'status': self.status,
            'total': self.total,
            'notes': self.notes,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
            'items': [i.to_dict() for i in self.items],
        }


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_item.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    menu_item = db.relationship('MenuItem')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.menu_item.name if self.menu_item else 'Unknown',
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'subtotal': round(self.quantity * self.unit_price, 2),
        }


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

SEED_MENU = [
    # Pizzas
    ('Margherita', 'Classic tomato sauce, fresh mozzarella, and basil.', 12.99, 'pizza', 'margherita.jpg'),
    ('Pepperoni', 'Loaded with premium pepperoni and mozzarella.', 14.99, 'pizza', 'pepperoni.jpg'),
    ('BBQ Chicken', 'Smoky BBQ sauce, grilled chicken, red onion, and cilantro.', 15.99, 'pizza', 'bbq_chicken.jpg'),
    ('Veggie Delight', 'Bell peppers, mushrooms, olives, spinach, and feta.', 13.99, 'pizza', 'veggie.jpg'),
    ('Meat Lovers', 'Pepperoni, sausage, ham, and bacon on a rich tomato base.', 17.99, 'pizza', 'meat_lovers.jpg'),
    ('Hawaiian', 'Ham, pineapple, and mozzarella on tangy tomato sauce.', 14.49, 'pizza', 'hawaiian.jpg'),
    # Sides
    ('Garlic Knots (6)', 'Soft knots brushed with garlic butter and parsley.', 5.99, 'side', 'garlic_knots.jpg'),
    ('Caesar Salad', 'Crisp romaine, parmesan, croutons, and Caesar dressing.', 7.99, 'side', 'caesar.jpg'),
    ('Mozzarella Sticks (6)', 'Golden-fried with marinara dipping sauce.', 6.99, 'side', 'mozz_sticks.jpg'),
    ('Buffalo Wings (8)', 'Crispy wings tossed in buffalo sauce with ranch.', 10.99, 'side', 'wings.jpg'),
    # Drinks
    ('Soda (20 oz)', 'Coke, Diet Coke, Sprite, or Root Beer.', 2.49, 'drink', 'soda.jpg'),
    ('Lemonade', 'Fresh-squeezed house lemonade.', 2.99, 'drink', 'lemonade.jpg'),
    ('Water Bottle', 'Still water, 16.9 oz.', 1.49, 'drink', 'water.jpg'),
    # Desserts
    ('Tiramisu', 'Classic Italian dessert with mascarpone and espresso.', 5.99, 'dessert', 'tiramisu.jpg'),
    ('Cannoli (2)', 'Crispy shell filled with sweet ricotta cream.', 4.99, 'dessert', 'cannoli.jpg'),
]


def seed_menu():
    if MenuItem.query.count() == 0:
        for name, desc, price, cat, img in SEED_MENU:
            db.session.add(MenuItem(name=name, description=desc, price=price, category=cat, image=img))
        db.session.commit()


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    featured = MenuItem.query.filter_by(available=True, category='pizza').limit(3).all()
    return render_template('index.html', featured=featured)


@app.route('/menu')
def menu():
    category = request.args.get('category', 'all')
    if category == 'all':
        items = MenuItem.query.filter_by(available=True).order_by(MenuItem.category, MenuItem.name).all()
    else:
        items = MenuItem.query.filter_by(available=True, category=category).order_by(MenuItem.name).all()
    categories = ['all', 'pizza', 'side', 'drink', 'dessert']
    return render_template('menu.html', items=items, categories=categories, active=category)


@app.route('/order')
def order():
    return render_template('order.html')


@app.route('/confirmation/<int:order_id>')
def confirmation(order_id):
    order_obj = Order.query.get_or_404(order_id)
    return render_template('confirmation.html', order=order_obj)


@app.route('/admin')
def admin():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return render_template('admin.html', orders=orders)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.route('/api/menu')
def api_menu():
    category = request.args.get('category')
    query = MenuItem.query.filter_by(available=True)
    if category and category != 'all':
        query = query.filter_by(category=category)
    items = query.order_by(MenuItem.category, MenuItem.name).all()
    return jsonify([i.to_dict() for i in items])


@app.route('/api/orders', methods=['POST'])
def api_place_order():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    required = ['customer_name', 'customer_email', 'customer_phone', 'order_type', 'items']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'Missing field: {field}'}), 400

    if data['order_type'] == 'delivery' and not data.get('delivery_address'):
        return jsonify({'error': 'Delivery address is required for delivery orders'}), 400

    items_data = data['items']
    if not isinstance(items_data, list) or len(items_data) == 0:
        return jsonify({'error': 'Order must contain at least one item'}), 400

    total = 0.0
    order_items = []
    for entry in items_data:
        menu_item = MenuItem.query.get(entry.get('id'))
        if not menu_item or not menu_item.available:
            return jsonify({'error': f'Menu item {entry.get("id")} is unavailable'}), 400
        qty = int(entry.get('quantity', 1))
        if qty < 1:
            return jsonify({'error': 'Quantity must be at least 1'}), 400
        total += menu_item.price * qty
        order_items.append(OrderItem(menu_item_id=menu_item.id, quantity=qty, unit_price=menu_item.price))

    new_order = Order(
        customer_name=data['customer_name'].strip(),
        customer_email=data['customer_email'].strip(),
        customer_phone=data['customer_phone'].strip(),
        delivery_address=data.get('delivery_address', '').strip(),
        order_type=data['order_type'],
        total=round(total, 2),
        notes=data.get('notes', '').strip(),
        items=order_items,
    )
    db.session.add(new_order)
    db.session.commit()
    return jsonify({'order_id': new_order.id, 'total': new_order.total}), 201


@app.route('/api/orders/<int:order_id>', methods=['GET'])
def api_get_order(order_id):
    order_obj = Order.query.get_or_404(order_id)
    return jsonify(order_obj.to_dict())


@app.route('/api/orders/<int:order_id>/status', methods=['PATCH'])
def api_update_status(order_id):
    order_obj = Order.query.get_or_404(order_id)
    data = request.get_json(silent=True)
    allowed = ['Received', 'Preparing', 'Ready', 'Delivered', 'Cancelled']
    new_status = data.get('status') if data else None
    if new_status not in allowed:
        return jsonify({'error': f'Invalid status. Allowed: {allowed}'}), 400
    order_obj.status = new_status
    db.session.commit()
    return jsonify(order_obj.to_dict())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_menu()
    app.run(debug=True, port=5000)

import os
from flask import Flask, render_template, request, redirect, url_for, flash, abort
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime

app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///college.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_banned = db.Column(db.Boolean, default=False)
    rank = db.Column(db.Integer, default=0)  # Для иерархии авторитетов
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    comments = db.relationship('Comment', backref='author', lazy=True)
    posts = db.relationship('Post', backref='author', lazy=True)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), default='news')  # news, discussion, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    comments = db.relationship('Comment', backref='post', lazy=True, cascade='all, delete-orphan')

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function

def not_banned(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_authenticated and current_user.is_banned:
            logout_user()
            flash('Вы забанены!', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    posts = Post.query.order_by(Post.created_at.desc()).limit(10).all()
    return render_template('index.html', posts=posts)

@app.route('/register', methods=['GET', 'POST'])
@not_banned
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            flash('Введите имя пользователя и пароль', 'error')
            return redirect(url_for('register'))
        
        if User.query.filter_by(username=username).first():
            flash('Пользователь с таким именем уже существует', 'error')
            return redirect(url_for('register'))
        
        user = User(
            username=username,
            password_hash=generate_password_hash(password)
        )
        
        # Первый пользователь становится админом
        if User.query.count() == 0:
            user.is_admin = True
        
        db.session.add(user)
        db.session.commit()
        
        flash('Регистрация успешна! Войдите.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
@not_banned
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            if user.is_banned:
                flash('Вы забанены!', 'error')
                return redirect(url_for('login'))
            
            login_user(user)
            flash('Вход выполнен успешно!', 'success')
            return redirect(url_for('index'))
        
        flash('Неверное имя пользователя или пароль', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('index'))

@app.route('/post/<int:post_id>')
def view_post(post_id):
    post = Post.query.get_or_404(post_id)
    return render_template('post.html', post=post)

@app.route('/create_post', methods=['GET', 'POST'])
@login_required
@not_banned
def create_post():
    if request.method == 'POST':
        title = request.form.get('title')
        content = request.form.get('content')
        category = request.form.get('category', 'discussion')
        
        if not title or not content:
            flash('Заголовок и контент обязательны', 'error')
            return redirect(url_for('create_post'))
        
        post = Post(
            title=title,
            content=content,
            category=category,
            author_id=current_user.id
        )
        
        db.session.add(post)
        db.session.commit()
        
        flash('Пост создан!', 'success')
        return redirect(url_for('view_post', post_id=post.id))
    
    return render_template('create_post.html')

@app.route('/post/<int:post_id>/comment', methods=['POST'])
@login_required
@not_banned
def add_comment(post_id):
    post = Post.query.get_or_404(post_id)
    content = request.form.get('content')
    
    if not content:
        flash('Комментарий не может быть пустым', 'error')
        return redirect(url_for('view_post', post_id=post_id))
    
    comment = Comment(
        content=content,
        post_id=post_id,
        author_id=current_user.id
    )
    
    db.session.add(comment)
    db.session.commit()
    
    flash('Комментарий добавлен!', 'success')
    return redirect(url_for('view_post', post_id=post_id))

@app.route('/authorities')
def authorities():
    users = User.query.filter(User.rank > 0).order_by(User.rank.desc(), User.created_at).all()
    return render_template('authorities.html', users=users)

# Admin routes
@app.route('/admin')
@login_required
@admin_required
def admin_panel():
    users = User.query.all()
    posts = Post.query.order_by(Post.created_at.desc()).all()
    comments = Comment.query.order_by(Comment.created_at.desc()).limit(20).all()
    return render_template('admin.html', users=users, posts=posts, comments=comments)

@app.route('/admin/user/<int:user_id>/ban', methods=['POST'])
@login_required
@admin_required
def ban_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id != current_user.id:
        user.is_banned = True
        db.session.commit()
        flash(f'Пользователь {user.username} забанен', 'success')
    else:
        flash('Нельзя забанить самого себя', 'error')
    return redirect(url_for('admin_panel'))

@app.route('/admin/user/<int:user_id>/unban', methods=['POST'])
@login_required
@admin_required
def unban_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_banned = False
    db.session.commit()
    flash(f'Пользователь {user.username} разбанен', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/admin/user/<int:user_id>/toggle_admin', methods=['POST'])
@login_required
@admin_required
def toggle_admin(user_id):
    user = User.query.get_or_404(user_id)
    if user.id != current_user.id:
        user.is_admin = not user.is_admin
        db.session.commit()
        flash(f'Права администратора для {user.username} изменены', 'success')
    else:
        flash('Нельзя изменить свои права', 'error')
    return redirect(url_for('admin_panel'))

@app.route('/admin/comment/<int:comment_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    post_id = comment.post_id
    db.session.delete(comment)
    db.session.commit()
    flash('Комментарий удален', 'success')
    return redirect(url_for('view_post', post_id=post_id))

@app.route('/admin/post/<int:post_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    db.session.delete(post)
    db.session.commit()
    flash('Пост удален', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/admin/user/<int:user_id>/set_rank', methods=['POST'])
@login_required
@admin_required
def set_user_rank(user_id):
    user = User.query.get_or_404(user_id)
    rank = int(request.form.get('rank', 0))
    user.rank = rank
    db.session.commit()
    flash(f'Ранг пользователя {user.username} установлен на {rank}', 'success')
    return redirect(url_for('admin_panel'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)

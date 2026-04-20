# Инструкция по установке и запуску сайта колледжа

## Требования
- Python 3.8+
- VPS с Ubuntu/Debian
- Домен (уже есть)
- Nginx

## 1. Установка зависимостей

```bash
cd /workspace/college_site
pip install -r requirements.txt
```

## 2. Инициализация базы данных

База данных создастся автоматически при первом запуске приложения.
Первый зарегистрированный пользователь станет администратором автоматически.

```bash
cd /workspace/college_site
python app/main.py
```

## 3. Настройка Gunicorn (production сервер)

Скопируйте файл службы systemd:

```bash
sudo cp /workspace/college_site/college.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable college
sudo systemctl start college
```

Проверьте статус:
```bash
sudo systemctl status college
```

## 4. Настройка Nginx

### Вариант A: Если nginx ещё не настроен

1. Отредактируйте файл nginx.conf, заменив `your-domain.com` на ваш домен:
```bash
nano /workspace/college_site/nginx.conf
```

2. Скопируйте конфигурацию в nginx:
```bash
sudo cp /workspace/college_site/nginx.conf /etc/nginx/sites-available/college
sudo ln -s /etc/nginx/sites-available/college /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # если есть
```

3. Проверьте конфигурацию и перезапустите nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Настройка SSL (HTTPS) - рекомендуется

Установите Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
```

Получите сертификат:
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot автоматически обновит конфигурацию nginx.

## 6. Доступ к сайту

- Главная страница: `http://your-domain.com`
- Регистрация: `http://your-domain.com/register`
- Вход: `http://your-domain.com/login`
- Авторитеты: `http://your-domain.com/authorities`
- Админ панель: `http://your-domain.com/admin` (только для админов)

## Функционал

### Для всех пользователей:
- Просмотр новостей и обсуждений
- Комментарии к постам (после регистрации)
- Создание постов (после регистрации)
- Страница "Авторитеты колледжа" с иерархией

### Регистрация:
- По нику и паролю
- Первый зарегистрированный пользователь становится админом автоматически

### Админ панель (полные права):
- ✅ Бан/разбан пользователей
- ✅ Редактирование рангов пользователей (для иерархии авторитетов)
- ✅ Назначение/снятие прав администратора
- ✅ Удаление любых комментариев
- ✅ Удаление любых постов
- ✅ Просмотр всех пользователей, постов и комментариев

## База данных

Используется SQLite (файл `college.db`). Для переключения на MongoDB потребуется модификация кода.

## Структура проекта

```
college_site/
├── app/
│   └── main.py          # Основное приложение Flask
├── templates/           # HTML шаблоны
│   ├── base.html
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── post.html
│   ├── create_post.html
│   ├── authorities.html
│   └── admin.html
├── static/
│   └── css/
│       └── style.css    # Стили
├── requirements.txt     # Зависимости Python
├── college.service      # systemd служба для Gunicorn
└── nginx.conf           # Конфигурация nginx
```

## Безопасность

⚠️ **Важно:** Перед запуском в production измените секретный ключ в `app/main.py`:

```python
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
```

Замените на случайную строку.

## Управление службами

```bash
# Перезапуск приложения
sudo systemctl restart college

# Просмотр логов
sudo journalctl -u college -f

# Остановка
sudo systemctl stop college
```

export type Locale = 'en' | 'ru';

const translations = {
  // Sidebar
  'nav.home': { en: 'Home', ru: 'Главная' },
  'nav.sessions': { en: 'Sessions', ru: 'Сессии' },
  'nav.terminal': { en: 'Terminal', ru: 'Терминал' },
  'nav.fileManager': { en: 'File Manager', ru: 'Файлы' },
  'nav.keys': { en: 'Keys', ru: 'Ключи' },
  'nav.scripts': { en: 'Scripts', ru: 'Скрипты' },
  'nav.tunnels': { en: 'Tunnels', ru: 'Туннели' },
  'nav.settings': { en: 'Settings', ru: 'Настройки' },

  // Home
  'home.welcome': { en: 'Welcome to valkyrieTUN', ru: 'Добро пожаловать в valkyrieTUN' },
  'home.subtitle': { en: 'Modern SSH client — connect to your servers securely', ru: 'Современный SSH клиент — безопасное подключение к серверам' },
  'home.quickConnect': { en: 'Quick Connect', ru: 'Быстрое подключение' },
  'home.quickPlaceholder': { en: 'user@hostname:port', ru: 'user@hostname:port' },
  'home.connect': { en: 'Connect', ru: 'Подключить' },
  'home.recentSessions': { en: 'Recent Sessions', ru: 'Недавние сессии' },
  'home.clearAll': { en: 'Clear All', ru: 'Очистить всё' },
  'home.savedSessions': { en: 'Saved Sessions', ru: 'Сохранённых' },
  'home.sshKeys': { en: 'SSH Keys', ru: 'SSH Ключей' },
  'home.savedScripts': { en: 'Saved Scripts', ru: 'Скриптов' },
  'home.cancel': { en: 'Cancel', ru: 'Отмена' },
  'home.password': { en: 'Password', ru: 'Пароль' },
  'home.privateKey': { en: 'Private Key', ru: 'Приватный ключ' },
  'home.sshAgent': { en: 'SSH Agent', ru: 'SSH Агент' },
  'home.authMethod': { en: 'Authentication', ru: 'Аутентификация' },
  'home.keyPath': { en: 'Private key path', ru: 'Путь к ключу' },
  'home.passphrase': { en: 'Passphrase (optional)', ru: 'Пароль ключа (опционально)' },
  'home.saveSession': { en: 'Save this session', ru: 'Сохранить сессию' },
  'home.sessionName': { en: 'Session name', ru: 'Имя сессии' },
  'home.group': { en: 'Group', ru: 'Группа' },
  'home.noGroup': { en: 'No group', ru: 'Без группы' },
  'home.newGroup': { en: 'New', ru: 'Новая' },
  'home.newGroupName': { en: 'New group name...', ru: 'Имя группы...' },
  'home.noActiveSessions': { en: 'No active terminal sessions', ru: 'Нет активных терминальных сессий' },
  'home.openSession': { en: 'Open a Session', ru: 'Открыть сессию' },

  // Sessions
  'sessions.title': { en: 'Sessions', ru: 'Сессии' },
  'sessions.search': { en: 'Search sessions...', ru: 'Поиск сессий...' },
  'sessions.newSession': { en: 'New Session', ru: 'Новая сессия' },
  'sessions.allGroups': { en: 'All', ru: 'Все' },
  'sessions.noSessions': { en: 'No sessions found', ru: 'Сессии не найдены' },
  'sessions.addFirst': { en: 'Add your first server connection', ru: 'Добавьте первое подключение' },
  'sessions.import': { en: 'Import', ru: 'Импорт' },
  'sessions.export': { en: 'Export', ru: 'Экспорт' },

  // Session Editor
  'editor.editSession': { en: 'Edit Session', ru: 'Редактирование' },
  'editor.newSession': { en: 'New Session', ru: 'Новая сессия' },
  'editor.name': { en: 'Name', ru: 'Имя' },
  'editor.host': { en: 'Host', ru: 'Хост' },
  'editor.port': { en: 'Port', ru: 'Порт' },
  'editor.username': { en: 'Username', ru: 'Пользователь' },
  'editor.save': { en: 'Save', ru: 'Сохранить' },
  'editor.delete': { en: 'Delete', ru: 'Удалить' },
  'editor.advanced': { en: 'Advanced', ru: 'Дополнительно' },
  'editor.notes': { en: 'Notes', ru: 'Заметки' },
  'editor.colorTag': { en: 'Color Tag', ru: 'Цвет метки' },
  'editor.postLogin': { en: 'Post-login script', ru: 'Скрипт после входа' },
  'editor.keepalive': { en: 'Keepalive Interval (ms)', ru: 'Keepalive интервал (мс)' },

  // Terminal
  'terminal.connecting': { en: 'Connecting to', ru: 'Подключение к' },
  'terminal.connectionClosed': { en: 'Connection closed', ru: 'Соединение закрыто' },
  'terminal.sessionNotFound': { en: 'Session not found', ru: 'Сессия не найдена' },
  'terminal.splitVertical': { en: 'Split Vertical', ru: 'Разделить вертикально' },
  'terminal.splitHorizontal': { en: 'Split Horizontal', ru: 'Разделить горизонтально' },
  'terminal.broadcast': { en: 'Broadcast', ru: 'Трансляция' },
  'terminal.newTab': { en: 'New Tab', ru: 'Новая вкладка' },

  // File Manager
  'files.title': { en: 'File Manager', ru: 'Файловый менеджер' },
  'files.local': { en: 'Local', ru: 'Локальные' },
  'files.remote': { en: 'Remote', ru: 'Удалённые' },
  'files.upload': { en: 'Upload', ru: 'Загрузить' },
  'files.download': { en: 'Скачать', ru: 'Скачать' },
  'files.newFolder': { en: 'New Folder', ru: 'Новая папка' },
  'files.delete': { en: 'Delete', ru: 'Удалить' },
  'files.rename': { en: 'Rename', ru: 'Переименовать' },

  // Keys
  'keys.title': { en: 'SSH Keys', ru: 'SSH Ключи' },
  'keys.generate': { en: 'Generate Key', ru: 'Создать ключ' },
  'keys.import': { en: 'Import Key', ru: 'Импортировать' },
  'keys.detectLocal': { en: 'Detect Local Keys', ru: 'Найти локальные' },
  'keys.noKeys': { en: 'No SSH keys found', ru: 'Ключи не найдены' },

  // Scripts
  'scripts.title': { en: 'Script Library', ru: 'Библиотека скриптов' },
  'scripts.newScript': { en: 'New Script', ru: 'Новый скрипт' },
  'scripts.noScripts': { en: 'No scripts yet', ru: 'Скриптов пока нет' },

  // Tunnels
  'tunnels.title': { en: 'Port Forwarding', ru: 'Перенаправление портов' },
  'tunnels.newTunnel': { en: 'New Tunnel', ru: 'Новый туннель' },
  'tunnels.noTunnels': { en: 'No tunnels configured', ru: 'Туннели не настроены' },

  // Settings
  'settings.title': { en: 'Settings', ru: 'Настройки' },
  'settings.appearance': { en: 'Appearance', ru: 'Внешний вид' },
  'settings.terminal': { en: 'Terminal', ru: 'Терминал' },
  'settings.security': { en: 'Security', ru: 'Безопасность' },
  'settings.about': { en: 'About', ru: 'О программе' },
  'settings.theme': { en: 'Theme', ru: 'Тема' },
  'settings.dark': { en: 'Dark', ru: 'Тёмная' },
  'settings.light': { en: 'Light', ru: 'Светлая' },
  'settings.accentColor': { en: 'Accent Color', ru: 'Цвет акцента' },
  'settings.font': { en: 'Font', ru: 'Шрифт' },
  'settings.fontFamily': { en: 'Font Family', ru: 'Семейство шрифта' },
  'settings.fontSize': { en: 'Font Size', ru: 'Размер шрифта' },
  'settings.cursor': { en: 'Cursor', ru: 'Курсор' },
  'settings.scrollback': { en: 'Scrollback Buffer (lines)', ru: 'Буфер прокрутки (строк)' },
  'settings.shellEnhancement': { en: 'Shell Enhancement', ru: 'Улучшение оболочки' },
  'settings.autoZsh': { en: 'Auto-install Oh My Zsh + Powerlevel10k on first connect', ru: 'Автоустановка Oh My Zsh + Powerlevel10k при первом подключении' },
  'settings.autoZshDesc': { en: 'When enabled, automatically sets up zsh with Oh My Zsh and Powerlevel10k theme on remote servers that don\'t have it. Requires root or sudo access.', ru: 'При включении автоматически устанавливает zsh с Oh My Zsh и темой Powerlevel10k на удалённые серверы. Требуется root или sudo доступ.' },
  'settings.bellSound': { en: 'Terminal Bell Sound', ru: 'Звук терминала' },
  'settings.enableBell': { en: 'Enable bell sound in terminal', ru: 'Включить звук колокольчика в терминале' },
  'settings.language': { en: 'Language', ru: 'Язык' },

  // Security
  'security.masterPassword': { en: 'Master Password', ru: 'Мастер-пароль' },
  'security.masterDesc': { en: 'Master password encrypts all stored passwords and keys with AES-256-GCM. You will need to enter it each time the app starts.', ru: 'Мастер-пароль шифрует все сохранённые пароли и ключи с помощью AES-256-GCM. При запуске приложения нужно будет вводить этот пароль.' },
  'security.active': { en: 'Master password is active', ru: 'Мастер-пароль активен' },
  'security.currentToRemove': { en: 'Current password to remove...', ru: 'Текущий пароль для удаления...' },
  'security.remove': { en: 'Remove password', ru: 'Удалить пароль' },
  'security.newPassword': { en: 'New password...', ru: 'Новый пароль...' },
  'security.confirmPassword': { en: 'Confirm password...', ru: 'Подтвердите пароль...' },
  'security.setPassword': { en: 'Set', ru: 'Установить' },
  'security.minChars': { en: 'Minimum 4 characters', ru: 'Минимум 4 символа' },
  'security.noMatch': { en: 'Passwords do not match', ru: 'Пароли не совпадают' },
  'security.wrongPassword': { en: 'Wrong password', ru: 'Неверный пароль' },
  'security.enterCurrent': { en: 'Enter current password', ru: 'Введите текущий пароль' },
  'security.setSuccess': { en: 'Master password set. All passwords encrypted.', ru: 'Мастер-пароль установлен. Все пароли зашифрованы.' },
  'security.removeSuccess': { en: 'Master password removed. Passwords decrypted.', ru: 'Мастер-пароль удалён. Пароли расшифрованы.' },
  'security.encryption': { en: 'Encryption', ru: 'Шифрование' },
  'security.encryptionDesc': { en: 'Algorithm: AES-256-GCM with PBKDF2 (100,000 iterations, SHA-512). Each password is encrypted with a separate random IV.', ru: 'Алгоритм: AES-256-GCM с PBKDF2 (100,000 итераций, SHA-512). Каждый пароль шифруется отдельным случайным IV.' },

  // Lock screen
  'lock.title': { en: 'Enter master password', ru: 'Введите мастер-пароль для входа' },
  'lock.placeholder': { en: 'Master password...', ru: 'Мастер-пароль...' },
  'lock.submit': { en: 'Unlock', ru: 'Войти' },
  'lock.verifying': { en: 'Verifying...', ru: 'Проверка...' },
  'lock.wrong': { en: 'Wrong password', ru: 'Неверный пароль' },
  'lock.error': { en: 'Verification error', ru: 'Ошибка проверки' },
  'lock.encrypted': { en: 'All data encrypted with AES-256-GCM', ru: 'Все данные зашифрованы AES-256-GCM' },

  // About
  'about.title': { en: 'About valkyrieTUN', ru: 'О valkyrieTUN' },
  'about.description': { en: 'A production-ready SSH client with terminal emulation, SFTP file management, key management, scripts, and port forwarding. Built with Electron, React, and xterm.js.', ru: 'Готовый к продакшену SSH клиент с эмуляцией терминала, SFTP файловым менеджером, управлением ключами, скриптами и перенаправлением портов. Построен на Electron, React и xterm.js.' },
  'about.noCloud': { en: 'No cloud sync. No telemetry. Fully offline. All data stays local.', ru: 'Без облачной синхронизации. Без телеметрии. Полностью оффлайн. Все данные локальны.' },

  // Common
  'common.block': { en: 'Block', ru: 'Блок' },
  'common.underline': { en: 'Underline', ru: 'Подчёркивание' },
  'common.bar': { en: 'Bar', ru: 'Полоска' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[locale] || entry.en;
}

export default translations;

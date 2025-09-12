#!/bin/bash
# Автоматический пуш в GitHub

# Добавляем все файлы
git add .

# Делаем коммит с текущей датой и временем
git commit -m "update: $(date '+%Y-%m-%d %H:%M:%S')"

# Пушим в main
git push origin main

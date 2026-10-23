# Отчёт по попыткам извлечения тел статей (article-extractor / Readability)

Дата: 2026-10-23  
Проект: `hellorobot` (`D:/docs/GitHub/hellorobot`)  
Источник кандидатов: `docs/research/candidates.json` (295 записей)  
Инструмент: `npm run extract:article -- <url>` (`scripts/extract-article.mjs` → Mozilla Readability + jsdom)  
Ограничение: 14 извлечений (2 на группу × 7 групп: JP, CN, DE, FR, KR, US, None).

## Сводка

| # | Страна | Домен | Результат | Объём текста | Причина (если ошибка) |
|---|--------|-------|-----------|--------------|-----------------------|
| 1 | JP | news.google.com | Ошибка | 0 | JS-интерстишиал Google News, Readability не нашёл статью |
| 2 | JP | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 3 | CN | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 4 | CN | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 5 | DE | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 6 | DE | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 7 | FR | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 8 | FR | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 9 | KR | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 10 | KR | news.google.com | Ошибка | 0 | JS-интерстишиал Google News |
| 11 | US | www.therobotreport.com | Ошибка | 0 | HTTP 403 (защита от ботов/WAF) |
| 12 | US | techcrunch.com | Успех | ~825 слов / ~5.2k симв. | — |
| 13 | None | robohub.org | Успех | ~1121 слов / ~7.2k симв. | — |
| 14 | None | discourse.openrobotics.org | Успех (коротко) | ~49 слов / ~1.0k симв. | Форумный пост, мало контента |

## Детали по URL

### 1. JP — `https://news.google.com/rss/articles/CBMiakFVX3lxTE5qa05TUjREcnZvWVltY0lmWE0wMThxcE5pc0VDZURaQVN1WmFzNWJkZml6MEhOMFgzZDdkMWpNX0ROTExmM1NEYVZUVG1aWnF3d0JWX3JhVzJueWZKN1p2cFE5cU1Kd2xzVWc?oc=5`
- Страна: JP
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: страница Google News — JS-интерстишиал с `data-n-a-sg`/`data-n-a-ts`, статья рендерится клиентом и перенаправляет на оригинал; серверного article-HTML нет, Readability возвращает `null`. Издатель скрыт за JS/batchexecute.

### 2. JP — `https://news.google.com/rss/articles/CBMiZEFVX3lxTE5LZFBIcUItQ29XaEtmaTc4MXVScDhZSWRRN09qY2xFWXBIOWoxQXRxTkJVcDEyQXItSjRRQkQ5UlhYRXFPRklDWVd4UGFzNzZaWk5RZFNqaWktclRWdHFJMzZDYWs?oc=5`
- Страна: JP
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: то же (JS-интерстишиал Google News).

### 3. CN — `https://news.google.com/rss/articles/CBMiZEFVX3lxTE4xNnhHMmJ5UFE4ek1YZU83YkY3NENuakhlMlRhUkI4ZUdDeTJReWlYZkNTWFRGR2JIZF9JeU5tbEREcVFYcmhEaXJTbXl2WWJVZ2k1dGQ3ZGExdnhYYzNQZWs4TDg?oc=5`
- Страна: CN
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 4. CN — `https://news.google.com/rss/articles/CBMi1AFBVV95cUxQNEhfamRnNHY4SVpqWG5kaFRSSXhCNkhMS0xlWVVES0dtazRYSkZBSmtJaWtzODhlMzBVaWZyQkR0Q3BZWHZEektueENVazg2b1pOdVdoNU44Qm5SVlpwVjlpMVNPN0RWYVFidGw0ZHVsYU5WTEE3UzhkT3hQdW1RbTBibjRkdl85YVozU1BDZzRrNENzT3FHUlVXTzJIY3hGZUlmTFRfejhUZGktRjN3RTdIZ25OUXExMXRHcXM0c2pmOVdNV1lJRHVQaHZZa3R4b01MVg?oc=5`
- Страна: CN
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 5. DE — `https://news.google.com/rss/articles/CBMizgFBVV95cUxQRTR0a1hSZWhkaTJkZXd6WmtNcGlxcDU2Z1EzRk1tUi1hZng5MmlucU83UGM2VEZMVnNjTWFBZFZYTGdfckFWMGNJS2tsTDhRTWpZekZibDRwWWk0SWNxYUp5bWZuN2lULXpNT2Q2LVlDT0NDcGhOc29VSVpKNlFheU44TTdlQTFjM0NwSzAwMXJScHc2MDZub2pCa1VpNHJveXhUZGVvLS14N3JldjdXSmJCTzVCUWl5dWY5bm9CMncxZUQydnNFLTJBdFdXQQ?oc=5`
- Страна: DE
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 6. DE — `https://news.google.com/rss/articles/CBMiyAFBVV95cUxNRGlsTGdQRUdhc1V0VGZwQWRNbFFaTFBWSFJ6LS1za1JQOEJCTlczTnZaMzJaY1VXVlMxaFdYNTFqSEdFQ1Y1bWVYbGU1M0ZLaTBYNndQeUF6T1pnc2JSc2VmWjVJN1RpbV92VzdUUEw3SW5OSk5VQ09WbmtFYWlZNzVadWc4X0FNUUNVYUtJVktCZU9HSGZSUDlvdVAxektyaWp6RUNSUFFaY2J2N3NzNWhkME5zSWZpQks5UGdwMDZfdkptcTBBUw?oc=5`
- Страна: DE
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 7. FR — `https://news.google.com/rss/articles/CBMicEFVX3lxTE5MSmR2TzZHazhqd09CRGtIUHZ1N0d6UTF5aGVRNTRBODRRTmg5NEVlMkV3blQ5YjctWGw2aHpKZUUzRjdwcGZrYVlvYzNOeVhhcHg4VzNYTE9JSElPdkZDR3JibFlNVlZqTHhoaVFLNnA?oc=5`
- Страна: FR
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 8. FR — `https://news.google.com/rss/articles/CBMikwFBVV95cUxONFk5SWdBWFVVWFViaHoxRUdrT1pvVnh0Q2dqSTBQM0hDdnNnOWVoS3g0OFBfRF93Tm9IdFFLZ014SGgtTjF5VkNzMmpYUXBTUVlRMF8yZHdTTi16TFduY194U3czdUdObTlUekh5am4weW5TZWxhWWttc2MtT3JMaXljQnBPWmxSNlo2U2kwTU1CT0U?oc=5`
- Страна: FR
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 9. KR — `https://news.google.com/rss/articles/CBMicEFVX3lxTE11eFZuNVdXLTMxandWRjVTR0ptQmVoclV6LWtYY2kxVGlyV0hGQ2lFYlVPcUdOeTBnWEVLb1dGZ1p3WFF2MGlZTWtsUzNyZmVqUHFFRnpfQlVPV1l0TXdmVE5wc3dxTGtxYVFXS3FvWGo?oc=5`
- Страна: KR
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 10. KR — `https://news.google.com/rss/articles/CBMiU0FVX3lxTE5OTnNqQTZDSnRSLVg0bThtckFFZTRkYVF2UGtRcUxDcm81LTNodHJaZkVZQmtXUm1fSWpRLTJOT2JCdVBXNjNObUVON2xKbjNaMU1B?oc=5`
- Страна: KR
- Домен: `news.google.com`
- Результат: ошибка (`Could not extract article`)
- Объём: 0
- Причина: JS-интерстишиал Google News.

### 11. US — `https://www.therobotreport.com/reservoir-launches-new-agricultural-robotics-incubator-for-washington-growers`
- Страна: US
- Домен: `www.therobotreport.com`
- Результат: ошибка (`403 ...`)
- Объём: 0
- Причина: HTTP 403 — защита от ботов/WAF (даже с браузерным User-Agent). Возможен paywall/anti-scraping, либо блокировка по IP/заголовкам.

### 12. US — `https://techcrunch.com/2026/10/13/rivians-startup-mind-robotics-hires-former-ford-ev-chief-doug-field`
- Страна: US
- Домен: `techcrunch.com`
- Результат: успех
- Объём: ~825 слов (~5.2k символов)
- Заголовок: «Rivian’s startup Mind Robotics hires former Ford EV chief Doug Field»
- siteName: TechCrunch

### 13. None — `https://robohub.org/robotics-and-automation-informal-reflections-on-familiar-terms`
- Страна: None (источник без страны: Robohub)
- Домен: `robohub.org`
- Результат: успех
- Объём: ~1121 слов (~7.2k символов)
- Заголовок: «Robotics and automation? Informal reflections on familiar terms»
- siteName: Robohub

### 14. None — `https://discourse.openrobotics.org/t/founding-robotics-engineer-subsea-autonomy/59020`
- Страна: None (ROS Discourse)
- Домен: `discourse.openrobotics.org`
- Результат: успех (короткий пост)
- Объём: ~49 слов (~1.0k символов)
- Заголовок: «Founding Robotics Engineer - Subsea/Autonomy»
- siteName: Open Robotics Discourse

## Общие подходы/паттерны для будущего скилла «try parse url»

### Что работает
- Статические статьи на обычных новостных/блоговых движках (TechCrunch, Robohub): Readability извлекает `title`, `byline`, `textContent`, `siteName`; объём 0.8–1.2k слов.
- Форумные посты (Discourse) извлекаются, но контент короткий (40–60 слов) — для «статьи» нужен порог объёма.
- Прямые HTTP 200 с серверным HTML без тяжёлого JS — основной критерий успеха.

### Что не работает
- Google News (`news.google.com/rss/articles/...`): HTTP 200, но это JS-интерстишиал с `data-n-a-sg`/`data-n-a-ts`; оригинал скрыт за клиентским редиректом/batchexecute. Readability возвращает `null`. Нужен отдельный шаг декодирования Google News URL (или переход на RSS/оригинальный URL), иначе извлекать нечего.
- Защита от ботов/WAF (The Robot Report): HTTP 403 даже с браузерным UA. Нужны ретраи с другими заголовками/куками или обход (не гарантирован). Такие источники помечать как «недоступны для автоматического парсинга».
- Агрегаторы/редиректы: домен кандидата (`news.google.com`) не равен домену издателя; отчёт по домену нужно строить по финальному URL после редиректа, а не по кандидату.
- Короткие посты/форумы: формально «успех», но контента недостаточно — нужен фильтр по минимальному объёму (например ≥200 слов).

### Рекомендации для скилла
1. Сначала проверить статус/Content-Type и объём HTML; при 4xx/5xx — сразу классифицировать (403→бот-защита, 404→нет страницы, 429→лимит).
2. Детектить Google News по хосту и не пытаться Readability напрямую; декодировать URL или пропускать.
3. После Readability проверять `textContent.length`/слова; если `null` или < N слов — помечать как «пустая/JS-страница», а не «успех».
4. Разделять «ошибка сети/HTTP» и «успех Readability, но мало текста».
5. Сохранять финальный URL и домен издателя, а не URL-агрегатора.
6. Для paywall/JS-сайтов иметь fallback: попробовать альтернативный источник или пометить источник как непарсящийся.
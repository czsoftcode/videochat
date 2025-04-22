# Platforma VideoChat

Webová platforma pro videohovory postavená na Symfony 7.2 a WebRTC.

## Funkce

- Registrace a autentizace uživatelů
- Veřejné a soukromé místnosti pro videohovory
- Komunikace v reálném čase (video a audio)
- Sdílení obrazovky
- Správa místností (vytvoření, připojení, opuštění)
- WebRTC pro peer-to-peer komunikaci
- WebSocket signalizační server pro aktualizace v reálném čase

## Technologický stack

- **Backend**: Symfony 7.2 s PHP 8.2+
- **Databáze**: PostgreSQL
- **Frontend**: Twig, JavaScript, Bootstrap 5
- **WebRTC**: knihovna PeerJS
- **Komunikace v reálném čase**: WebSocket server
- **Autentizace**: JWT pro API, Session pro webové rozhraní

## Rychlý start

### 1. Konfigurace databáze

Upravte soubor `.env` a nastavte připojení k databázi:

```
DATABASE_URL="postgresql://username:password@127.0.0.1:5432/videochat?serverVersion=16&charset=utf8"
```

### 2. Instalace závislostí

```bash
composer install
```

### 3. Vytvoření schématu databáze

```bash
php bin/console doctrine:schema:create
```

### 4. Spuštění signalizačního serveru (vyžadováno pro video chat)

```bash
# Nejdůležitější krok - musí běžet v samostatném terminálu!
bin/run-signaling.sh
```

### 5. Spuštění vývojového serveru Symfony

```bash
php bin/console server:start
```

### 6. Přístup k aplikaci

Otevřete prohlížeč a přejděte na adresu:
```
http://localhost:8000
```

## Používání platformy

1. **Zaregistrujte účet** kliknutím na "Register" v horní navigační liště
2. **Vytvořte místnost** kliknutím na tlačítko "Create a Room"
3. **Pozvěte ostatní** sdílením odkazu místnosti nebo pomocí funkce pozvání
4. **Připojte se k videohovoru** vstupem do místnosti
5. **Spravujte místnosti** z vašeho dashboardu

## Řešení problémů

### Problémy s kamerou/mikrofonem

Pokud máte problémy s přístupem ke kameře nebo mikrofonu:

1. Ujistěte se, že váš prohlížeč má povolení pro přístup ke kameře a mikrofonu
2. Zkontrolujte, zda vaši kameru nepoužívá jiná aplikace
3. Zkuste použít jiný prohlížeč (doporučujeme Chrome, Firefox nebo Edge)
4. Zkontrolujte konzoli prohlížeče pro konkrétní chybové zprávy

### Problémy s připojením

Pokud se uživatelé nemohou vzájemně propojit:

1. Ujistěte se, že signalizační server běží (`bin/run-signaling.sh`)
2. Zkontrolujte, že vaše zařízení jsou ve stejné síti nebo že máte správné připojení k internetu
3. Zkuste použít jinou síť, pokud je to možné (některé restriktivní sítě blokují WebRTC připojení)

## Licence

Tento projekt je licencován pod licencí MIT - viz soubor LICENSE pro podrobnosti.
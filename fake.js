// OTO FAKE GECE BONUSU — core logic (load via Tampermonkey @require)
(function (global) {
    'use strict';

    function run(config) {
        const isConfirmPageEarly = () =>
            /[?&]try=confirm|[?&]action=confirm/i.test(location.search) ||
            /saldırıyı onayla|confirm the attack/i.test(document.body.textContent || '') ||
            !!document.querySelector(
                'input[name="submit_confirm"], .btn-confirm-no, #troop_confirm_submit, #troop_confirm_go'
            );

        if (typeof game_data === 'undefined') {
            console.log('game_data bulunamadı.');
            return;
        }
        if (game_data.screen !== 'place' && !isConfirmPageEarly()) {
            console.log('Bu script sadece toplanma meydanı ekranında çalışır.');
            return;
        }

        const targets = Array.isArray(config.targets)
            ? config.targets
            : String(config.targets || '').trim().split(/\s+/).filter(Boolean);
        const units = config.units || {};
        const cookieName = config.cookieName || 'bs';

        const GECE_BONUSU_RE = /uyku\s+modu\s+aktif|gece\s+bonusu|night\s+bonus|sleep\s+mode(?:\s+is)?\s+active/i;

        const pageMessages = () => Array.from(document.querySelectorAll(
            '.error, .error_box, .info_box, .warn_box, .warning, .alert, .boxed, #command-data, #troop_confirm'
        ));

        const hasGeceBonusu = () => {
            for (const el of document.querySelectorAll('.info_box .content, .info_box')) {
                if (GECE_BONUSU_RE.test((el.textContent || '').trim())) return true;
            }
            for (const el of pageMessages()) {
                if (GECE_BONUSU_RE.test(el.textContent || '')) return true;
            }
            const confirmRoot = document.querySelector('#content_value, #content, #place_confirm');
            if (confirmRoot && GECE_BONUSU_RE.test(confirmRoot.textContent || '')) return true;
            return false;
        };

        const isConfirmPage = () =>
            isConfirmPageEarly() ||
            !!getConfirmButton();

        const getConfirmButton = () => {
            const direct = document.querySelector(
                'input[name="submit_confirm"], #troop_confirm_submit, #troop_confirm_go, button[name="submit_confirm"], .btn-confirm-no'
            );
            if (direct) return direct;
            for (const el of document.querySelectorAll('input[type="submit"], button[type="submit"], input[type="button"]')) {
                const label = ((el.value || '') + ' ' + (el.textContent || '')).trim();
                if (/saldırı\s*gönder|send\s*attack/i.test(label)) return el;
            }
            return (document.forms[0] && document.forms[0].submit_confirm) || null;
        };

        const nextVillage = () => {
            const nextButton = document.querySelector('.arrowRight, .groupRight');
            if (nextButton && !nextButton.disabled) {
                nextButton.click();
                console.log('Sonraki köye geçildi.');
            } else {
                console.log('Sonraki köy butonu bulunamadı veya aktif değil!');
            }
        };

        const skipToNextVillage = (reason, revertTarget) => {
            if (revertTarget) {
                const current = parseInt(localStorage.getItem(cookieName), 10) || 0;
                if (current > 0) localStorage.setItem(cookieName, current - 1);
            }
            console.log(reason);
            nextVillage();
        };

        const cancelConfirmAndNextVillage = (reason) => {
            const current = parseInt(localStorage.getItem(cookieName), 10) || 0;
            if (current > 0) localStorage.setItem(cookieName, current - 1);
            console.log(reason);
            localStorage.setItem('goNextVillage', 'true');
            window.location.href = window.location.origin + '/game.php?screen=place';
        };

        if (localStorage.getItem('goNextVillage') === 'true') {
            localStorage.removeItem('goNextVillage');
            nextVillage();
            return;
        }

        if (isConfirmPage()) {
            const cancelForGeceBonusu = () =>
                cancelConfirmAndNextVillage('Gece bonusu aktif, saldırı iptal edildi — sonraki köye geçiliyor.');

            if (hasGeceBonusu()) {
                cancelForGeceBonusu();
                return;
            }

            const randomConfirmDelay = Math.floor(Math.random() * 1000) + 1200;
            setTimeout(() => {
                if (hasGeceBonusu()) {
                    cancelForGeceBonusu();
                    return;
                }
                const confirmBtn = getConfirmButton();
                if (!confirmBtn) {
                    console.log('Onay butonu bulunamadı.');
                    return;
                }
                localStorage.setItem('goNextVillage', 'true');
                confirmBtn.click();
                console.log('Gece bonusu yok, saldırı onaylandı. Köy geçişi sonraki sayfada yapılacak.');
            }, randomConfirmDelay);
            return;
        }

        const alertCaptcha = () => alert('Captcha algılandı! Lütfen doğrulama yapınız.');

        const setInputValue = (input, value) => {
            if (!input) return false;
            const v = String(value);
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(input, v);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return input.value === v;
        };

        const insertUnits = (form, unitMap) => {
            Object.entries(unitMap).forEach(([unit, count]) => {
                if (count > 0 && form[unit]) {
                    setInputValue(form[unit], count);
                }
            });
        };

        const getAttackButton = () => {
            const candidates = [
                document.querySelector('#target_attack'),
                document.forms[0] && document.forms[0].attack,
                document.querySelector('input[name="attack"]'),
                document.querySelector('button[name="attack"]'),
                document.querySelector('a.btn-attack'),
            ];
            return candidates.find(btn => btn && btn.offsetParent !== null) || candidates.find(Boolean) || null;
        };

        const coordsMatchTarget = (form, targetX, targetY) =>
            form && form.x && form.y &&
            String(form.x.value).trim() === String(targetX) &&
            String(form.y.value).trim() === String(targetY);

        const isTargetLoaded = (targetX, targetY) => {
            const coord = `${targetX}|${targetY}`;
            const areas = document.querySelectorAll(
                '#place_target, #target_select, #place_confirm, .target-select-wrapper, #target_list, #content_value'
            );
            for (const area of areas) {
                if (area.textContent.includes(coord)) return true;
            }
            return false;
        };

        const isCoordsReady = (form, targetX, targetY) =>
            coordsMatchTarget(form, targetX, targetY) &&
            (isTargetLoaded(targetX, targetY) || !!getAttackButton());

        const unitsFilled = (form, unitMap) =>
            Object.entries(unitMap).every(([unit, count]) =>
                !count || (form[unit] && String(form[unit].value).trim() === String(count))
            );

        const clickAttack = (form, targetX, targetY, targetIndex, attempt = 0) => {
            const maxAttempts = 40;

            if (!coordsMatchTarget(form, targetX, targetY)) {
                setInputValue(form.x, targetX);
                setInputValue(form.y, targetY);
                form.y.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            insertUnits(form, units);

            if (!isCoordsReady(form, targetX, targetY) || !unitsFilled(form, units)) {
                if (attempt >= maxAttempts) {
                    console.log('Saldırı öncesi form hazır değil, iptal edildi.');
                    return;
                }
                setTimeout(() => clickAttack(form, targetX, targetY, targetIndex, attempt + 1), 100);
                return;
            }

            const attackBtn = getAttackButton();
            if (!attackBtn) {
                if (attempt >= maxAttempts) {
                    console.log('Saldır butonu bulunamadı.');
                    return;
                }
                setTimeout(() => clickAttack(form, targetX, targetY, targetIndex, attempt + 1), 100);
                return;
            }

            localStorage.setItem(cookieName, targetIndex + 1);
            attackBtn.click();
            console.log(`Saldırı gönderiliyor: ${targetX}|${targetY}`);
        };

        const waitAndAttack = (form, targetX, targetY, targetIndex) => {
            const maxAttempts = 50;
            let attempt = 0;

            const tick = () => {
                if (!form || !form.x || !form.y) {
                    console.log('Form hazır değil.');
                    return;
                }

                if (!coordsMatchTarget(form, targetX, targetY)) {
                    setInputValue(form.x, targetX);
                    setInputValue(form.y, targetY);
                    form.y.dispatchEvent(new Event('blur', { bubbles: true }));
                }

                if (!isCoordsReady(form, targetX, targetY)) {
                    if (++attempt >= maxAttempts) {
                        console.log('Hedef koordinatları yüklenemedi, saldırı iptal edildi.');
                        return;
                    }
                    setTimeout(tick, 100);
                    return;
                }

                const randomDelay = Math.floor(Math.random() * 500) + 400;
                setTimeout(() => clickAttack(form, targetX, targetY, targetIndex), randomDelay);
            };

            setTimeout(tick, 150);
        };

        const hasNotEnoughUnits = () => pageMessages().some(el =>
            el.textContent.includes('Yeterli birim yok') || el.textContent.includes('Not enough units')
        );

        const getUnitAvailable = (unit) => {
            if (typeof game_data !== 'undefined' && game_data.units && game_data.units[unit] != null) {
                return parseInt(game_data.units[unit], 10) || 0;
            }
            const input = document.querySelector(`#unit_input_${unit}, input[name="${unit}"]`);
            if (!input) return 0;
            const row = input.closest('td, tr');
            const match = row && row.textContent.match(/\((\d+)\)/);
            return match ? parseInt(match[1], 10) : 0;
        };

        const hasRequiredUnits = (unitMap) => Object.entries(unitMap).every(([unit, count]) =>
            !count || getUnitAvailable(unit) >= count
        );

        if (document.body.dataset.botProtect !== undefined) {
            alertCaptcha();
            return;
        }

        if (!targets.length) {
            console.log('Hedef koordinat listesi boş.');
            return;
        }

        let actual = parseInt(localStorage.getItem(cookieName), 10) || 0;

        if (actual >= targets.length) {
            if (confirm('Tüm saldırılar gönderildi. Tekrar başlatmak ister misiniz?')) {
                actual = 0;
                localStorage.setItem(cookieName, '0');
            } else {
                return;
            }
        }

        const [x, y] = targets[actual].split('|');
        const form = document.forms[0];

        const uyar = pageMessages().some(el =>
            el.textContent.includes('Son 24 saat içerisinde')
        );

        if (uyar) {
            skipToNextVillage('Gece bonusu zaman dilimi değişikliği nedeniyle atlanıyor...', false);
            return;
        }

        if (hasNotEnoughUnits()) {
            skipToNextVillage('Yeterli birim yok, sonraki köye geçiliyor...', true);
            return;
        }

        if (!hasRequiredUnits(units)) {
            skipToNextVillage('Köyde yeterli birim yok, sonraki köye geçiliyor...', false);
            return;
        }

        if (form && x && y) {
            if (!coordsMatchTarget(form, x, y)) {
                setInputValue(form.x, '');
                setInputValue(form.y, '');
                setInputValue(form.x, x);
                setInputValue(form.y, y);
                form.y.dispatchEvent(new Event('blur', { bubbles: true }));
            }
            waitAndAttack(form, x, y, actual);
            return;
        }

        console.log('Form veya hedef uygun değil.');
    }

    global.TW_OtoFakeGeceBonusu = { run: run, version: '1.7' };
})(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

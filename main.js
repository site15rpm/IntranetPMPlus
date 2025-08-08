/ --- CONFIGURAÇÃO ---
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5ib6FUpSDoxpOiJvuwskFU5vBLyt_UqxQ5CtmizLMLZFEtSRbdIPef9WHYv913NZ7Gg/exec';
    const DEFAULT_TYPING_DELAY = 25; // Atraso em ms entre cada comando de digitação

    // --- Variáveis Globais ---
    let isRecording = false;
    let currentRecordingName = '';
    let macroActions = []; // Formato: { data: '...' }
    let recordingDisposable = null;
    let fetchedMacros = {};

    // --- FUNÇÃO DE NOTIFICAÇÃO ---
    const showNotification = (message, isSuccess = true, duration = 4000) => {
        const notificationDiv = document.createElement('div');
        Object.assign(notificationDiv.style, {
            position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: '8px', color: 'white',
            backgroundColor: isSuccess ? '#28a745' : '#ffc107', zIndex: '10000',
            fontFamily: 'sans-serif', boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            color: isSuccess ? 'white' : 'black'
        });
        notificationDiv.textContent = message;
        document.body.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), duration);
    };

    // --- LÓGICA DO MENU HTML ---
    const createMenu = (term) => {
        const menuContainer = document.createElement('div');
        menuContainer.innerHTML = `
            <div id="macro-menu-container">
                <button id="macro-menu-toggle">☰ Macros</button>
                <div id="macro-menu-dropdown" style="display: none;">
                    <div class="macro-menu-section">Ações</div>
                    <button class="macro-menu-item" id="macro-record-login-btn">🔴 Gravar/Sobrescrever Macro de Login</button>
                    <button class="macro-menu-item" id="macro-record-btn">⏺️ Gravar Nova Macro</button>
                    <button class="macro-menu-item" id="macro-stop-btn" style="display: none;">⏹️ Parar Gravação</button>
                    <button class="macro-menu-item" id="macro-manage-btn">🗑️ Gerir Macros</button>
                    <hr>
                    <div class="macro-menu-section">Executar Macro</div>
                    <div id="macro-list-container">
                        <div class="macro-menu-item-static">A carregar macros...</div>
                    </div>
                    <hr>
                    <div class="macro-menu-section">Configuração</div>
                    <button class="macro-menu-item" id="macro-set-user-btn">👤 Definir Usuário</button>
                    <button class="macro-menu-item" id="macro-set-pass-btn">🔑 Definir Senha</button>
                </div>
            </div>
        `;
        document.body.appendChild(menuContainer);

        const style = document.createElement('style');
        style.textContent = `
            #macro-menu-container { position: fixed; top: 10px; right: 10px; z-index: 9999; font-family: sans-serif; }
            #macro-menu-toggle { background-color: #0056b3; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 14px; }
            #macro-menu-dropdown { display: none; position: absolute; right: 0; background-color: #f9f9f9; min-width: 220px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 1; border-radius: 5px; padding: 8px 0; }
            .macro-menu-section { padding: 8px 12px; color: #555; font-size: 12px; font-weight: bold; }
            .macro-menu-item, .macro-menu-item-static { padding: 8px 12px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 14px; }
            .macro-menu-item:hover { background-color: #f1f1f1; }
            hr { border: 0; border-top: 1px solid #ddd; margin: 8px 0; }
        `;
        document.head.appendChild(style);

        document.getElementById('macro-menu-toggle').addEventListener('click', () => {
            document.getElementById('macro-menu-dropdown').style.display =
                document.getElementById('macro-menu-dropdown').style.display === 'block' ? 'none' : 'block';
        });
        document.getElementById('macro-set-user-btn').addEventListener('click', () => {
            const user = prompt("Digite seu usuário do terminal:");
            if (user) { GM_setValue("terminal_user", user); showNotification("Usuário salvo."); }
        });
        document.getElementById('macro-set-pass-btn').addEventListener('click', () => {
            const pass = prompt("Digite sua senha do terminal:");
            if (pass) { GM_setValue("terminal_pass", pass); showNotification("Senha salva."); }
        });
        document.getElementById('macro-record-login-btn').addEventListener('click', () => startRecording(term, '_Login'));
        document.getElementById('macro-record-btn').addEventListener('click', () => startRecording(term));
        document.getElementById('macro-stop-btn').addEventListener('click', stopRecording);
        document.getElementById('macro-manage-btn').addEventListener('click', () => manageMacros(term));

        fetchMacros(term);
    };

    // --- FUNÇÕES DE MACRO ---
    const fetchMacros = (term) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: APPS_SCRIPT_URL + "?action=list",
            onload: function(response) {
                try {
                    fetchedMacros = JSON.parse(response.responseText);
                    populateMacroList(term);
                    if (fetchedMacros['_Login']) {
                        executeMacro(term, '_Login');
                    }
                } catch (e) {
                    console.error("Erro ao processar macros:", e);
                }
            },
            onerror: (response) => console.error("Erro ao buscar macros:", response)
        });
    };

    const populateMacroList = (term) => {
        const container = document.getElementById('macro-list-container');
        container.innerHTML = '';
        const names = Object.keys(fetchedMacros).filter(name => name !== '_Login').sort();
        if (names.length === 0) {
            container.innerHTML = `<div class="macro-menu-item-static">Nenhuma macro encontrada.</div>`;
            return;
        }
        names.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'macro-menu-item';
            btn.textContent = `▶️ ${name}`;
            btn.onclick = () => executeMacro(term, name);
            container.appendChild(btn);
        });
    };

    const startRecording = (term, predefinedName = '') => {
        if (isRecording) {
            showNotification("A gravação já está em andamento.", false);
            return;
        }
        let name = predefinedName;
        if (!name) {
            name = prompt("Digite um nome para a nova macro:");
            if (!name || !name.trim()) {
                showNotification("Gravação cancelada. Nome inválido.", false);
                return;
            }
            if (fetchedMacros[name.trim()]) {
                showNotification(`Macro "${name.trim()}" já existe.`, false);
                return;
            }
        } else {
            if (fetchedMacros[name] && !confirm(`Deseja sobrescrever a macro de login existente?`)) return;
            showNotification("Grave a macro de login. Use %%USER%% e %%PASS%% para as credenciais.");
        }

        isRecording = true;
        currentRecordingName = name.trim();
        macroActions = [];
        document.getElementById('macro-record-btn').style.display = 'none';
        document.getElementById('macro-record-login-btn').style.display = 'none';
        document.getElementById('macro-stop-btn').style.display = 'block';

        recordingDisposable = term.onData(data => {
            if (!isRecording) return;
            macroActions.push({ data });
        });
        showNotification(`🔴 Gravando macro "${currentRecordingName}"...`);
    };

    const stopRecording = () => {
        if (!isRecording) {
            showNotification("Nenhuma gravação em andamento.", false);
            return;
        }
        isRecording = false;
        if (recordingDisposable) {
            recordingDisposable.dispose();
            recordingDisposable = null;
        }
        document.getElementById('macro-record-btn').style.display = 'block';
        document.getElementById('macro-record-login-btn').style.display = 'block';
        document.getElementById('macro-stop-btn').style.display = 'none';

        const macroText = convertActionsToText(macroActions);

        showNotification(`Salvando macro "${currentRecordingName}"...`);
        GM_xmlhttpRequest({
            method: "POST",
            url: APPS_SCRIPT_URL,
            data: JSON.stringify({
                action: 'save',
                name: currentRecordingName,
                content: macroText
            }),
            headers: { "Content-Type": "application/json" },
            onload: function(response) {
                const res = JSON.parse(response.responseText);
                if (res.status === 'success') {
                    showNotification(`✔️ Macro "${currentRecordingName}" salva com sucesso!`);
                    fetchMacros(unsafeWindow.term);
                } else {
                    showNotification(`Erro ao salvar macro: ${res.message}`, false);
                }
            },
            onerror: (response) => showNotification("Erro de rede ao salvar macro.", false)
        });
        currentRecordingName = '';
    };

    const convertActionsToText = (actions) => {
        if (actions.length === 0) return "";
        let result = [];
        let currentText = "";

        // Mapeia códigos de escape para nomes de teclas legíveis
        const keyMap = {
            '\r': 'ENTER',
            '\t': 'TAB',
            '\x7f': 'BACKSPACE',
            '\b': 'BACKSPACE',
            '\x1b[3~': 'DELETE',
            '\x1b[F': 'END',
            '\x1b[4~': 'END',
            '\x1bOP': 'PF1',
            '\x1bOQ': 'PF2',
            '\x1bOR': 'PF3',
            '\x1bOS': 'PF4',
            '\x1b[15~': 'PF5',
            '\x1b[17~': 'PF6',
            '\x1b[18~': 'PF7',
            '\x1b[19~': 'PF8',
            '\x1b[20~': 'PF9',
            '\x1b[21~': 'PF10',
            '\x1b[23~': 'PF11',
            '\x1b[24~': 'PF12',
        };

        for (const action of actions) {
            const specialKey = keyMap[action.data];
            if (specialKey) {
                if (currentText) {
                    result.push(currentText);
                    currentText = "";
                }
                result.push(specialKey);
            } else {
                currentText += action.data;
            }
        }

        if (currentText) {
            result.push(currentText);
        }

        return result.join('\n');
    };

    const executeMacro = async (term, name) => {
        let macroText = fetchedMacros[name];
        if (!macroText) {
            showNotification(`Macro "${name}" não encontrada.`, false);
            return;
        }

        showNotification(`▶️ Executando macro "${name}"...`);
        term.focus();

        if (name === '_Login') {
            const user = GM_getValue("terminal_user", null);
            const pass = GM_getValue("terminal_pass", null);
            if (!user || !pass) {
                showNotification("Usuário/senha não definidos para o login.", false);
                return;
            }
            macroText = macroText.replace(/%%USER%%/g, user).replace(/%%PASS%%/g, pass);
        }

        const lines = macroText.split('\n').filter(line => line.trim() !== '');

        // Mapeia nomes de teclas legíveis para códigos de escape
        const keyMap = {
            'ENTER': '\r',
            'TAB': '\t',
            'BACKSPACE': '\x7f',
            'DELETE': '\x1b[3~',
            'END': '\x1b[F',
            'PF1': '\x1bOP',
            'PF2': '\x1bOQ',
            'PF3': '\x1bOR',
            'PF4': '\x1bOS',
            'PF5': '\x1b[15~',
            'PF6': '\x1b[17~',
            'PF7': '\x1b[18~',
            'PF8': '\x1b[19~',
            'PF9': '\x1b[20~',
            'PF10': '\x1b[21~',
            'PF11': '\x1b[23~',
            'PF12': '\x1b[24~',
        };

        for (const line of lines) {
            const upperLine = line.trim().toUpperCase();
            if (upperLine.startsWith('PAUSA')) {
                const parts = upperLine.split(' ');
                const seconds = parts.length > 1 ? parseInt(parts[1], 10) : 1;
                await new Promise(resolve => setTimeout(resolve, isNaN(seconds) ? 1000 : seconds * 1000));
            } else if (keyMap[upperLine]) {
                term.paste(keyMap[upperLine]);
                await new Promise(resolve => setTimeout(resolve, DEFAULT_TYPING_DELAY));
            } else {
                term.paste(line.trim());
                await new Promise(resolve => setTimeout(resolve, DEFAULT_TYPING_DELAY));
            }
        }
        showNotification(`✔️ Macro "${name}" executada.`);
    };

    const manageMacros = (term) => {
        const names = Object.keys(fetchedMacros);
        if (names.length === 0) {
            showNotification("Nenhuma macro salva para gerir.", false);
            return;
        }
        const promptText = "Qual macro você deseja apagar?\n\n" +
            names.map((name, i) => `${i + 1}: ${name}`).join('\n') +
            "\n\nDigite o NÚMERO da macro.";
        const choice = prompt(promptText);
        if (!choice) return;

        const index = parseInt(choice, 10) - 1;
        if (!isNaN(index) && index >= 0 && index < names.length) {
            const nameToDelete = names[index];
            if (confirm(`Tem certeza que deseja apagar a macro "${nameToDelete}"?`)) {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: APPS_SCRIPT_URL,
                    data: JSON.stringify({ action: 'delete', name: nameToDelete }),
                    headers: { "Content-Type": "application/json" },
                    onload: function(response) {
                        const res = JSON.parse(response.responseText);
                        if (res.status === 'success') {
                            showNotification(`🗑️ Macro "${nameToDelete}" apagada.`);
                            fetchMacros(term);
                        } else {
                            showNotification(`Erro ao apagar: ${res.message}`, false);
                        }
                    },
                    onerror: (res) => showNotification("Erro de rede ao apagar macro.", false)
                });
            }
        } else {
            showNotification("Seleção inválida.", false);
        }
    };

    // --- INICIALIZAÇÃO ---
    const initialize = (term) => {
        createMenu(term);
    };

    const waitForLoginPrompt = (term) => {
        let attempts = 0;
        const maxAttempts = 100;
        const interval = setInterval(() => {
            for (let i = 0; i < term.buffer.active.length; i++) {
                const line = term.buffer.active.getLine(i);
                if (line && line.translateToString().includes('Aplicacao:')) {
                    clearInterval(interval);
                    initialize(term);
                    return;
                }
            }
            if (++attempts > maxAttempts) {
                clearInterval(interval);
                showNotification("Erro: Prompt de login não encontrado.", false);
            }
        }, 100);
    };

    const waitForTerminal = () => {
        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
            if (typeof unsafeWindow.term !== 'undefined' && typeof unsafeWindow.term.paste === 'function') {
                clearInterval(interval);
                waitForLoginPrompt(unsafeWindow.term);
            } else if (++attempts > maxAttempts) {
                clearInterval(interval);
                showNotification("Erro: API do terminal não encontrada.", false);
            }
        }, 100);
    };

    window.addEventListener('load', waitForTerminal);

/**
 * IntranetPMPlus - Sistema de Macros para Terminal
 * Este script é carregado dinamicamente por um UserScript (loader).
 * Ele injeta a UI e a lógica para gravar, salvar e executar macros no terminal.
 *
 * Autor: Cleriston Tameirão Silva & Manus AI
 * Versão: 3.0 (Refatorada)
 */

class TerminalMacros {
    // --- 1. CONFIGURAÇÃO E CONSTANTES ---
    constructor(term) {
        this.term = term; // A instância do terminal (xterm.js)

        // -- Endpoints e Configurações --
        this.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5ib6FUpSDoxpOiJvuwskFU5vBLyt_UqxQ5CtmizLMLZFEtSRbdIPef9WHYv913NZ7Gg/exec';
        this.DEFAULT_TYPING_DELAY = 50; // Atraso em ms para uma digitação mais natural

        // -- Seletores de ID do Menu --
        this.MENU_IDS = {
            toggle: 'macro-menu-toggle',
            dropdown: 'macro-menu-dropdown',
            recordLogin: 'macro-record-login-btn',
            recordNew: 'macro-record-btn',
            stop: 'macro-stop-btn',
            manage: 'macro-manage-btn',
            listContainer: 'macro-list-container',
            setUser: 'macro-set-user-btn',
            setPass: 'macro-set-pass-btn',
        };

        // -- Estado da Aplicação --
        this.isRecording = false;
        this.currentRecordingName = '';
        this.macroActions = [];
        this.recordingDisposable = null;
        this.fetchedMacros = {};

        // -- Mapeamento de Teclas (Gravação -> Texto ) --
        this.recordingKeyMap = {
            '\r': 'ENTER', '\t': 'TAB', '\x7f': 'BACKSPACE', '\b': 'BACKSPACE',
            '\x1b[3~': 'DELETE', '\x1b[F': 'END', '\x1b[4~': 'END',
            '\x1bOP': 'PF1', '\x1bOQ': 'PF2', '\x1bOR': 'PF3', '\x1bOS': 'PF4',
            '\x1b[15~': 'PF5', '\x1b[17~': 'PF6', '\x1b[18~': 'PF7', '\x1b[19~': 'PF8',
            '\x1b[20~': 'PF9', '\x1b[21~': 'PF10', '\x1b[23~': 'PF11', '\x1b[24~': 'PF12',
        };

        // -- Mapeamento de Teclas (Texto -> Execução) --
        this.executionKeyMap = Object.fromEntries(
            Object.entries(this.recordingKeyMap).map(([key, value]) => [value, key])
        );
    }

    // --- 2. INICIALIZAÇÃO ---
    init() {
        console.log("TerminalMacros: Inicializando sistema...");
        this.createMenu();
        this.addEventListeners();
        this.fetchMacros();
    }

    // --- 3. LÓGICA DA INTERFACE (UI) ---
    createMenu() {
        if (document.getElementById(this.MENU_IDS.toggle)) return; // Evita criar menu duplicado

        const menuContainer = document.createElement('div');
        menuContainer.innerHTML = `
            <div id="macro-menu-container">
                <button id="${this.MENU_IDS.toggle}">☰ Macros</button>
                <div id="${this.MENU_IDS.dropdown}" style="display: none;">
                    <div class="macro-menu-section">Ações</div>
                    <button class="macro-menu-item" id="${this.MENU_IDS.recordLogin}">🔴 Gravar/Sobrescrever Macro de Login</button>
                    <button class="macro-menu-item" id="${this.MENU_IDS.recordNew}">⏺️ Gravar Nova Macro</button>
                    <button class="macro-menu-item" id="${this.MENU_IDS.stop}" style="display: none;">⏹️ Parar Gravação</button>
                    <button class="macro-menu-item" id="${this.MENU_IDS.manage}">🗑️ Gerir Macros</button>
                    <hr>
                    <div class="macro-menu-section">Executar Macro</div>
                    <div id="${this.MENU_IDS.listContainer}"><div class="macro-menu-item-static">A carregar macros...</div></div>
                    <hr>
                    <div class="macro-menu-section">Configuração</div>
                    <button class="macro-menu-item" id="${this.MENU_IDS.setUser}">👤 Definir Usuário</button>
                    <button class="macro-menu-item" id="${this.MENU_IDS.setPass}">🔑 Definir Senha</button>
                </div>
            </div>`;
        document.body.appendChild(menuContainer);

        const style = document.createElement('style');
        style.textContent = `
            #macro-menu-container { position: fixed; top: 10px; right: 10px; z-index: 9999; font-family: sans-serif; }
            #macro-menu-toggle { background-color: #0056b3; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 14px; }
            #macro-menu-dropdown { display: none; position: absolute; right: 0; background-color: #f9f9f9; min-width: 220px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 1; border-radius: 5px; padding: 8px 0; }
            .macro-menu-section { padding: 8px 12px; color: #555; font-size: 12px; font-weight: bold; }
            .macro-menu-item, .macro-menu-item-static { padding: 8px 12px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 14px; }
            .macro-menu-item:hover { background-color: #f1f1f1; }
            hr { border: 0; border-top: 1px solid #ddd; margin: 8px 0; }`;
        document.head.appendChild(style);
    }

    addEventListeners() {
        document.getElementById(this.MENU_IDS.toggle).addEventListener('click', () => {
            const dropdown = document.getElementById(this.MENU_IDS.dropdown);
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
        document.getElementById(this.MENU_IDS.setUser).addEventListener('click', () => {
            const user = prompt("Digite seu usuário do terminal:");
            if (user) { GM_setValue("terminal_user", user); this.showNotification("Usuário salvo."); }
        });
        document.getElementById(this.MENU_IDS.setPass).addEventListener('click', () => {
            const pass = prompt("Digite sua senha do terminal:");
            if (pass) { GM_setValue("terminal_pass", pass); this.showNotification("Senha salva."); }
        });
        document.getElementById(this.MENU_IDS.recordLogin).addEventListener('click', () => this.startRecording('_Login'));
        document.getElementById(this.MENU_IDS.recordNew).addEventListener('click', () => this.startRecording());
        document.getElementById(this.MENU_IDS.stop).addEventListener('click', () => this.stopRecording());
        document.getElementById(this.MENU_IDS.manage).addEventListener('click', () => this.manageMacros());
    }

    populateMacroList() {
        const container = document.getElementById(this.MENU_IDS.listContainer);
        container.innerHTML = '';
        const names = Object.keys(this.fetchedMacros).filter(name => name !== '_Login').sort();

        if (names.length === 0) {
            container.innerHTML = `<div class="macro-menu-item-static">Nenhuma macro encontrada.</div>`;
            return;
        }
        names.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'macro-menu-item';
            btn.textContent = `▶️ ${name}`;
            btn.onclick = () => this.executeMacro(name);
            container.appendChild(btn);
        });
    }

    showNotification(message, isSuccess = true, duration = 4000) {
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
    }

    // --- 4. LÓGICA DE MACROS (Gravação, Execução, etc.) ---
    fetchMacros() {
        GM_xmlhttpRequest({
            method: "GET",
            url: this.APPS_SCRIPT_URL + "?action=list",
            onload: (response ) => {
                try {
                    this.fetchedMacros = JSON.parse(response.responseText);
                    this.populateMacroList();
                    if (this.fetchedMacros['_Login']) {
                        this.executeMacro('_Login');
                    }
                } catch (e) {
                    console.error("Erro ao processar macros:", e);
                    this.showNotification("Falha ao carregar macros.", false);
                }
            },
            onerror: (response) => {
                console.error("Erro de rede ao buscar macros:", response);
                this.showNotification("Erro de rede ao buscar macros.", false);
            }
        });
    }

    startRecording(predefinedName = '') {
        if (this.isRecording) {
            this.showNotification("A gravação já está em andamento.", false);
            return;
        }
        let name = predefinedName;
        if (!name) {
            name = prompt("Digite um nome para a nova macro:");
            if (!name || !name.trim()) {
                this.showNotification("Gravação cancelada. Nome inválido.", false);
                return;
            }
            if (this.fetchedMacros[name.trim()]) {
                this.showNotification(`Macro "${name.trim()}" já existe.`, false);
                return;
            }
        } else {
            if (this.fetchedMacros[name] && !confirm(`Deseja sobrescrever a macro de login existente?`)) return;
            this.showNotification("Grave a macro de login. Use %%USER%% e %%PASS%% para as credenciais.");
        }

        this.isRecording = true;
        this.currentRecordingName = name.trim();
        this.macroActions = [];
        document.getElementById(this.MENU_IDS.recordNew).style.display = 'none';
        document.getElementById(this.MENU_IDS.recordLogin).style.display = 'none';
        document.getElementById(this.MENU_IDS.stop).style.display = 'block';

        this.recordingDisposable = this.term.onData(data => {
            if (this.isRecording) this.macroActions.push({ data });
        });
        this.showNotification(`🔴 Gravando macro "${this.currentRecordingName}"...`);
    }

    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;
        if (this.recordingDisposable) {
            this.recordingDisposable.dispose();
            this.recordingDisposable = null;
        }
        document.getElementById(this.MENU_IDS.recordNew).style.display = 'block';
        document.getElementById(this.MENU_IDS.recordLogin).style.display = 'block';
        document.getElementById(this.MENU_IDS.stop).style.display = 'none';

        const macroText = this.convertActionsToText(this.macroActions);
        this.showNotification(`Salvando macro "${this.currentRecordingName}"...`);

        GM_xmlhttpRequest({
            method: "POST",
            url: this.APPS_SCRIPT_URL,
            data: JSON.stringify({
                action: 'save',
                name: this.currentRecordingName,
                content: macroText
            } ),
            headers: { "Content-Type": "application/json" },
            onload: (response) => {
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.status === 'success') {
                        this.showNotification(`✔️ Macro "${this.currentRecordingName}" salva com sucesso!`);
                        this.fetchMacros();
                    } else {
                        this.showNotification(`Erro ao salvar macro: ${res.message}`, false);
                    }
                } catch (e) {
                    this.showNotification('Erro de resposta do servidor ao salvar.', false);
                }
            },
            onerror: () => this.showNotification("Erro de rede ao salvar macro.", false)
        });
        this.currentRecordingName = '';
    }

    convertActionsToText(actions) {
        if (!actions.length) return "";
        let result = [];
        let currentText = "";

        for (const action of actions) {
            const specialKey = this.recordingKeyMap[action.data];
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
        if (currentText) result.push(currentText);
        return result.join('\n');
    }

    manageMacros() {
        const names = Object.keys(this.fetchedMacros);
        if (names.length === 0) {
            this.showNotification("Nenhuma macro salva para gerir.", false);
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
                    url: this.APPS_SCRIPT_URL,
                    data: JSON.stringify({ action: 'delete', name: nameToDelete } ),
                    headers: { "Content-Type": "application/json" },
                    onload: (response) => {
                        const res = JSON.parse(response.responseText);
                        if (res.status === 'success') {
                            this.showNotification(`🗑️ Macro "${nameToDelete}" apagada.`);
                            this.fetchMacros();
                        } else {
                            this.showNotification(`Erro ao apagar: ${res.message}`, false);
                        }
                    },
                    onerror: () => this.showNotification("Erro de rede ao apagar macro.", false)
                });
            }
        } else {
            this.showNotification("Seleção inválida.", false);
        }
    }

    // --- 5. EXECUTOR DE MACROS AVANÇADO ---
    async executeMacro(name) {
        let macroText = this.fetchedMacros[name];
        if (!macroText) {
            this.showNotification(`Macro "${name}" não encontrada.`, false);
            return;
        }

        this.showNotification(`▶️ Executando macro "${name}"...`);
        this.term.focus();

        if (name === '_Login') {
            const user = GM_getValue("terminal_user", "");
            const pass = GM_getValue("terminal_pass", "");
            if (!user || !pass) {
                this.showNotification("Usuário/senha não definidos para o login.", false);
                return;
            }
            macroText = macroText.replace(/%%USER%%/g, user).replace(/%%PASS%%/g, pass);
        }

        const lines = macroText.split('\n');
        const variables = {};

        const getScreenContent = () => {
            let content = '';
            for (let i = 0; i < this.term.buffer.active.length; i++) {
                content += this.term.buffer.active.getLine(i).translateToString() + '\n';
            }
            return content;
        };

        const resolveVariables = (text) => text.replace(/\{\{(.*?)\}\}/g, (_, varName) => variables[varName.trim()] || '');

        const processBlock = async (startLine, endCondition) => {
            let i = startLine;
            while (i < lines.length) {
                const originalLine = lines[i].trim();
                if (endCondition && endCondition(originalLine.toUpperCase())) return i;

                let line = resolveVariables(originalLine);
                const upperLine = line.toUpperCase();

                if (upperLine.startsWith('LOG ')) {
                    const msg = line.substring(4);
                    console.log(`[MACRO LOG] ${msg}`);
                    this.showNotification(msg, true, 2000);
                } else if (upperLine.startsWith('SET ')) {
                    const parts = line.substring(4).split('=');
                    variables[parts[0].trim()] = parts[1].trim().replace(/"/g, '');
                } else if (upperLine.startsWith('IF ')) {
                    const conditionText = line.match(/IF (.*) THEN/i)[1];
                    const screen = getScreenContent();
                    let conditionMet = false;
                    if (conditionText.toUpperCase().includes('SCREEN CONTAINS')) {
                        const searchText = conditionText.match(/SCREEN CONTAINS "(.*?)"/i)[1];
                        conditionMet = screen.includes(searchText);
                    }
                    if (!conditionMet) {
                        let nestLevel = 1;
                        while (++i < lines.length) {
                            const nextLineUpper = lines[i].trim().toUpperCase();
                            if (nextLineUpper.startsWith('IF ')) nestLevel++;
                            if (nextLineUpper === 'ENDIF') nestLevel--;
                            if ((nextLineUpper === 'ELSE' || nextLineUpper === 'ENDIF') && nestLevel === 0) break;
                        }
                    }
                } else if (upperLine === 'ELSE') {
                    let nestLevel = 1;
                    while (++i < lines.length) {
                        const nextLineUpper = lines[i].trim().toUpperCase();
                        if (nextLineUpper.startsWith('IF ')) nestLevel++;
                        if (nextLineUpper === 'ENDIF') {
                            nestLevel--;
                            if (nestLevel === 0) break;
                        }
                    }
                } else if (upperLine.startsWith('FOR ')) {
                    const [, varName, start, end] = line.match(/FOR (\w+) FROM (\S+) TO (\S+)/i);
                    const forBlockStart = i + 1;
                    for (let j = parseInt(start); j <= parseInt(end); j++) {
                        variables[varName] = j;
                        i = await processBlock(forBlockStart, (l) => l === 'ENDFOR');
                    }
                    while (i < lines.length && lines[i].trim().toUpperCase() !== 'ENDFOR') i++;
                } else if (upperLine.startsWith('WHILE ')) {
                    const conditionText = line.match(/WHILE (.*)/i)[1];
                    const whileBlockStart = i + 1;
                    let conditionMet = true;
                    while (conditionMet) {
                        const screen = getScreenContent();
                        if (conditionText.toUpperCase().includes('SCREEN CONTAINS')) {
                            conditionMet = screen.includes(conditionText.match(/SCREEN CONTAINS "(.*?)"/i)[1]);
                        } else if (conditionText.toUpperCase().includes('SCREEN NOT CONTAINS')) {
                            conditionMet = !screen.includes(conditionText.match(/SCREEN NOT CONTAINS "(.*?)"/i)[1]);
                        } else { break; }
                        if (conditionMet) {
                            await processBlock(whileBlockStart, (l) => l === 'ENDWHILE');
                        }
                    }
                    while (i < lines.length && lines[i].trim().toUpperCase() !== 'ENDWHILE') i++;
                } else if (upperLine.startsWith('PAUSA ')) {
                    const seconds = parseInt(upperLine.split(' ')[1], 10);
                    await new Promise(resolve => setTimeout(resolve, isNaN(seconds) ? 1000 : seconds * 1000));
                } else if (this.executionKeyMap[upperLine]) {
                    this.term.paste(this.executionKeyMap[upperLine]);
                    await new Promise(resolve => setTimeout(resolve, this.DEFAULT_TYPING_DELAY));
                } else if (line && !['ENDFOR', 'ENDIF', 'ENDWHILE', 'ELSE'].includes(upperLine)) {
                    this.term.paste(line);
                    await new Promise(resolve => setTimeout(resolve, this.DEFAULT_TYPING_DELAY));
                }
                i++;
            }
            return i;
        };

        await processBlock(0, null);
        this.showNotification(`✔️ Macro "${name}" executada.`);
    }
}

// --- 6. INICIALIZAÇÃO DO SCRIPT ---
function waitForTerminal() {
    let attempts = 0;
    const maxAttempts = 50; // Tenta por 5 segundos
    const interval = setInterval(() => {
        // O script injetado roda no contexto da página, então usamos 'window' diretamente.
        if (typeof window.term !== 'undefined' && typeof window.term.paste === 'function') { // <--- CORRIGIDO
            clearInterval(interval);
            console.log("Terminal encontrado. Verificando prompt de login...");
            waitForLoginPrompt(window.term); // <--- CORRIGIDO
        } else if (++attempts > maxAttempts) {
            clearInterval(interval);
            console.error("Erro: API do terminal (window.term) não encontrada.");
        }
    }, 100);
}

function waitForLoginPrompt(term) {
    let attempts = 0;
    const maxAttempts = 100; // Tenta por 10 segundos
    const interval = setInterval(() => {
        for (let i = 0; i < term.buffer.active.length; i++) {
            const line = term.buffer.active.getLine(i);
            if (line && line.translateToString().includes('Aplicacao:')) {
                clearInterval(interval);
                console.log("Prompt de login detectado. Iniciando o sistema de macros.");
                // Cria e inicia a aplicação de macros
                const macroSystem = new TerminalMacros(term);
                macroSystem.init();
                return;
            }
        }
        if (++attempts > maxAttempts) {
            clearInterval(interval);
            console.error("Erro: Prompt de login ('Aplicacao:') não encontrado na tela.");
        }
    }, 100);
}

// Inicia o processo de verificação assim que o script é executado.
waitForTerminal();
